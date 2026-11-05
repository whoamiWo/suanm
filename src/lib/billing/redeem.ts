import { and, eq } from 'drizzle-orm';
import { withTransaction, type Transaction } from '@/lib/db/client';
import {
  billingAccounts,
  billingLedger,
  redemptionCodes,
  subscriptionPlans,
  subscriptionPlanLimits,
  userSubscriptionLimits,
  userSubscriptions,
} from '@/lib/db/schema';

/**
 * 兑换码核销。
 *
 * 不变式（借鉴 taibu 已验证设计）：
 * - 兑换码只能被核销一次，靠唯一索引 + 条件更新双重保证。
 * - 余额与流水在同一事务内写入，不允许中间态。
 * - 流水带幂等键，防止重试造成重复入账。
 */

export class RedeemError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'USED'
      | 'EXPIRED'
      | 'DISABLED'
      | 'INCONSISTENT',
    message: string,
  ) {
    super(message);
    this.name = 'RedeemError';
  }
}

/** 核销结果 */
export interface RedeemResult {
  kind: 'balance' | 'subscription';
  amountMicros: number;
  subscriptionId?: string;
  title?: string;
}

/**
 * 核销兑换码。
 */
export async function redeemCode(code: string, userId: string): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new RedeemError('NOT_FOUND', '兑换码为空');

  return withTransaction(async (tx) => {
    const rows = await tx
      .select()
      .from(redemptionCodes)
      .where(eq(redemptionCodes.code, normalized))
      .limit(1);

    const record = rows[0];
    if (!record) throw new RedeemError('NOT_FOUND', '兑换码不存在');
    if (record.status === 'used') throw new RedeemError('USED', '兑换码已被使用');
    if (record.status === 'disabled') throw new RedeemError('DISABLED', '兑换码已被停用');
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new RedeemError('EXPIRED', '兑换码已过期');
    }
    if (record.kind === 'balance' && !record.amountMicros) {
      throw new RedeemError('INCONSISTENT', '兑换码配置异常：缺少额度');
    }
    if (record.kind === 'subscription' && !record.planId) {
      throw new RedeemError('INCONSISTENT', '兑换码配置异常：缺少套餐');
    }

    // 条件更新：只有 status 仍为 unused 时才生效，防止并发双花
    const updated = await tx
      .update(redemptionCodes)
      .set({ status: 'used', usedBy: userId, usedAt: new Date() })
      .where(and(eq(redemptionCodes.id, record.id), eq(redemptionCodes.status, 'unused')))
      .returning({ id: redemptionCodes.id });

    if (updated.length === 0) {
      throw new RedeemError('USED', '兑换码已被使用');
    }

    if (record.kind === 'balance') {
      const amount = record.amountMicros ?? 0;
      await creditWallet(tx, userId, amount, {
        kind: 'redeem',
        source: 'redeem-code',
        idempotencyKey: `redeem:${record.id}`,
        description: '兑换码充值',
        referenceType: 'redemption_code',
        referenceId: record.id,
      });
      return { kind: 'balance', amountMicros: amount };
    }

    const subscription = await activatePlan(tx, userId, record.planId!, {
      source: 'redeem',
      idempotencyKey: `redeem:${record.id}`,
      referenceId: record.id,
    });
    return {
      kind: 'subscription',
      amountMicros: 0,
      subscriptionId: subscription.id,
      title: subscription.title,
    };
  });
}

/**
 * 给用户钱包加钱并写流水。幂等：同一 idempotencyKey 只入账一次。
 */
export async function creditWallet(
  tx: Transaction,
  userId: string,
  amountMicros: number,
  meta: {
    kind: 'topup' | 'redeem' | 'adjust' | 'refund';
    source: string;
    idempotencyKey: string;
    description?: string;
    referenceType?: string;
    referenceId?: string;
  },
): Promise<number> {
  const existing = await tx
    .select({ id: billingLedger.id })
    .from(billingLedger)
    .where(eq(billingLedger.idempotencyKey, meta.idempotencyKey))
    .limit(1);
  if (existing.length > 0) {
    const acc = await tx
      .select({ balance: billingAccounts.balanceMicros })
      .from(billingAccounts)
      .where(eq(billingAccounts.userId, userId))
      .limit(1);
    return acc[0]?.balance ?? 0;
  }

  const current = await tx
    .select({ balance: billingAccounts.balanceMicros })
    .from(billingAccounts)
    .where(eq(billingAccounts.userId, userId))
    .limit(1);

  const before = current[0]?.balance ?? 0;
  const after = before + amountMicros;

  if (current.length === 0) {
    await tx.insert(billingAccounts).values({
      userId,
      balanceMicros: after,
      deductOrder: 'subscription',
    });
  } else {
    await tx
      .update(billingAccounts)
      .set({ balanceMicros: after, updatedAt: new Date() })
      .where(eq(billingAccounts.userId, userId));
  }

  await tx.insert(billingLedger).values({
    userId,
    kind: meta.kind,
    amountMicros,
    walletMicros: after,
    subscriptionParts: [],
    idempotencyKey: meta.idempotencyKey,
    source: meta.source,
    referenceType: meta.referenceType,
    referenceId: meta.referenceId,
    description: meta.description ?? '',
  });

  return after;
}

/**
 * 开通套餐订阅并按周期发放额度。
 */
export async function activatePlan(
  tx: Transaction,
  userId: string,
  planId: string,
  meta: {
    source: 'redeem' | 'epay' | 'admin' | 'balance';
    idempotencyKey: string;
    referenceId?: string;
  },
): Promise<{ id: string; title: string; endsAt: Date }> {
  const plans = await tx
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  const plan = plans[0];
  if (!plan) throw new RedeemError('INCONSISTENT', '套餐不存在');

  const limits = await tx
    .select()
    .from(subscriptionPlanLimits)
    .where(eq(subscriptionPlanLimits.planId, planId));

  const now = new Date();
  const endsAt = new Date(now);
  if (plan.durationUnit === 'day') {
    endsAt.setDate(endsAt.getDate() + plan.durationValue);
  } else if (plan.durationUnit === 'month') {
    endsAt.setMonth(endsAt.getMonth() + plan.durationValue);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + plan.durationValue);
  }

  const inserted = await tx
    .insert(userSubscriptions)
    .values({
      userId,
      planId,
      title: plan.title,
      startsAt: now,
      endsAt,
      status: 'active',
      source: meta.source,
    })
    .returning({ id: userSubscriptions.id });

  const subscriptionId = inserted[0].id;

  for (const limit of limits) {
    await tx.insert(userSubscriptionLimits).values({
      subscriptionId,
      period: limit.period,
      allowanceMicros: limit.allowanceMicros,
      usedMicros: 0,
      nextResetAt: nextResetAt(limit.period, now),
    });
  }

  await tx.insert(billingLedger).values({
    userId,
    kind: 'subscription',
    amountMicros: 0,
    walletMicros: 0,
    subscriptionParts: limits.map((l) => ({
      period: l.period,
      allowanceMicros: l.allowanceMicros,
    })),
    idempotencyKey: meta.idempotencyKey,
    source: meta.source,
    referenceType: 'subscription',
    referenceId: subscriptionId,
    description: `开通套餐：${plan.title}`,
  });

  return { id: subscriptionId, title: plan.title, endsAt };
}

/** 计算下一个重置时间 */
export function nextResetAt(period: string, from: Date): Date | null {
  const next = new Date(from);
  switch (period) {
    case 'five_hour': {
      const hours = (Math.floor(from.getHours() / 5) + 1) * 5;
      next.setHours(hours, 0, 0, 0);
      return next;
    }
    case 'daily': {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'weekly': {
      next.setDate(next.getDate() + (7 - from.getDay()));
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'monthly': {
      next.setMonth(next.getMonth() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'total':
    default:
      return null;
  }
}
