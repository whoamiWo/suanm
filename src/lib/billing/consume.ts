import { and, eq, gt } from 'drizzle-orm';
import { withTransaction, type Transaction } from '@/lib/db/client';
import {
  billingAccounts,
  billingLedger,
  userSubscriptionLimits,
  userSubscriptions,
} from '@/lib/db/schema';

/**
 * 额度扣减。
 *
 * 扣费顺序由 billing_accounts.deduct_order 决定（默认先订阅后钱包）：
 * - 订阅额度按窗口从短到长扣（five_hour → daily → weekly → monthly → total）
 * - 订阅额度不足的部分再扣钱包
 * - 有可用额度时允许把钱包扣成负数（避免因额度预估误差导致服务中断）
 */

export class InsufficientBalanceError extends Error {
  constructor(
    public readonly requiredMicros: number,
    public readonly availableMicros: number,
  ) {
    super('额度不足');
    this.name = 'InsufficientBalanceError';
  }
}

/** 额度快照（展示用） */
export interface BalanceSnapshot {
  walletMicros: number;
  subscriptionMicros: number;
  totalMicros: number;
  subscriptions: Array<{
    id: string;
    title: string;
    endsAt: Date;
    status: string;
  }>;
}

/** 扣费明细 */
export interface ConsumptionPart {
  period: string;
  subscriptionId: string;
  amountMicros: number;
}

type Period = 'five_hour' | 'daily' | 'weekly' | 'monthly' | 'total';

interface SubQuota {
  subscriptionId: string;
  period: Period;
  allowance: number;
  used: number;
}

/** 额度窗口的扣减优先级：先短后长 */
const PERIOD_ORDER = ['five_hour', 'daily', 'weekly', 'monthly', 'total'];

/** 查询可用额度 */
export async function getBalance(userId: string): Promise<BalanceSnapshot> {
  return withTransaction(async (tx) => {
    const accounts = await tx
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.userId, userId))
      .limit(1);

    const subs = await tx
      .select({
        id: userSubscriptions.id,
        title: userSubscriptions.title,
        endsAt: userSubscriptions.endsAt,
        status: userSubscriptions.status,
        period: userSubscriptionLimits.period,
        allowance: userSubscriptionLimits.allowanceMicros,
        used: userSubscriptionLimits.usedMicros,
      })
      .from(userSubscriptions)
      .innerJoin(
        userSubscriptionLimits,
        eq(userSubscriptionLimits.subscriptionId, userSubscriptions.id),
      )
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active'),
          gt(userSubscriptions.endsAt, new Date()),
        ),
      );

    let subscriptionMicros = 0;
    for (const s of subs) {
      subscriptionMicros += Math.max(0, s.allowance - s.used);
    }

    const walletMicros = accounts[0]?.balanceMicros ?? 0;
    return {
      walletMicros,
      subscriptionMicros,
      totalMicros: walletMicros + subscriptionMicros,
      subscriptions: subs.map((s) => ({
        id: s.id,
        title: s.title,
        endsAt: s.endsAt,
        status: s.status,
      })),
    };
  });
}

/**
 * 扣除额度。
 *
 * @param userId 用户
 * @param amountMicros 需要扣除的额度（micros）
 * @param meta 幂等键与来源信息
 * @throws InsufficientBalanceError 可用额度不足
 */
export async function consume(
  userId: string,
  amountMicros: number,
  meta: {
    modelKey?: string;
    usage?: Record<string, unknown>;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey: string;
  },
): Promise<{ chargedMicros: number; parts: ConsumptionPart[]; walletMicros: number }> {
  if (amountMicros <= 0) {
    return { chargedMicros: 0, parts: [], walletMicros: 0 };
  }

  return withTransaction(async (tx) => {
    // 幂等：已扣过则直接返回上次结果
    const existing = await tx
      .select()
      .from(billingLedger)
      .where(eq(billingLedger.idempotencyKey, meta.idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      const row = existing[0];
      return {
        chargedMicros: -row.amountMicros,
        parts: (row.subscriptionParts ?? []) as ConsumptionPart[],
        walletMicros: row.walletMicros,
      };
    }

    const accounts = await tx
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.userId, userId))
      .limit(1);
    const deductOrder = accounts[0]?.deductOrder ?? 'subscription';
    let walletMicros = accounts[0]?.balanceMicros ?? 0;

    const subs = await tx
      .select({
        subscriptionId: userSubscriptionLimits.subscriptionId,
        period: userSubscriptionLimits.period,
        allowance: userSubscriptionLimits.allowanceMicros,
        used: userSubscriptionLimits.usedMicros,
      })
      .from(userSubscriptionLimits)
      .innerJoin(
        userSubscriptions,
        eq(userSubscriptions.id, userSubscriptionLimits.subscriptionId),
      )
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active'),
          gt(userSubscriptions.endsAt, new Date()),
        ),
      );

    const availableSubscription = subs.reduce(
      (sum, s) => sum + Math.max(0, s.allowance - s.used),
      0,
    );
    const availableTotal = availableSubscription + Math.max(0, walletMicros);

    // 准入检查：完全无可用额度时拒绝
    if (availableTotal <= 0) {
      throw new InsufficientBalanceError(amountMicros, availableTotal);
    }

    const parts: ConsumptionPart[] = [];
    let remaining = amountMicros;

    if (deductOrder === 'subscription') {
      remaining = await deductFromSubscriptions(tx, subs, remaining, parts);
    }

    if (remaining > 0) {
      walletMicros -= remaining;
      await upsertWallet(tx, userId, walletMicros);
    }

    if (deductOrder !== 'subscription' && remaining > 0) {
      remaining = await deductFromSubscriptions(tx, subs, remaining, parts);
    }

    await tx.insert(billingLedger).values({
      userId,
      kind: 'usage',
      amountMicros: -amountMicros,
      walletMicros,
      subscriptionParts: parts,
      idempotencyKey: meta.idempotencyKey,
      modelKey: meta.modelKey,
      usage: meta.usage ?? null,
      source: 'ai',
      referenceType: meta.referenceType,
      referenceId: meta.referenceId,
      description: meta.description ?? '',
    });

    return { chargedMicros: amountMicros, parts, walletMicros };
  });
}

/** 从订阅额度中扣除，返回未扣完的剩余量 */
async function deductFromSubscriptions(
  tx: Transaction,
  subs: SubQuota[],
  remaining: number,
  parts: ConsumptionPart[],
): Promise<number> {
  let rest = remaining;
  const ordered = [...subs].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period),
  );

  for (const s of ordered) {
    if (rest <= 0) break;
    const available = Math.max(0, s.allowance - s.used);
    if (available <= 0) continue;
    const take = Math.min(available, rest);
    await tx
      .update(userSubscriptionLimits)
      .set({ usedMicros: s.used + take })
      .where(
        and(
          eq(userSubscriptionLimits.subscriptionId, s.subscriptionId),
          eq(userSubscriptionLimits.period, s.period),
        ),
      );
    parts.push({
      period: s.period,
      subscriptionId: s.subscriptionId,
      amountMicros: take,
    });
    rest -= take;
  }
  return rest;
}

/** 更新或创建钱包 */
async function upsertWallet(tx: Transaction, userId: string, balance: number) {
  const rows = await tx
    .select({ userId: billingAccounts.userId })
    .from(billingAccounts)
    .where(eq(billingAccounts.userId, userId))
    .limit(1);
  if (rows.length === 0) {
    await tx.insert(billingAccounts).values({ userId, balanceMicros: balance });
  } else {
    await tx
      .update(billingAccounts)
      .set({ balanceMicros: balance, updatedAt: new Date() })
      .where(eq(billingAccounts.userId, userId));
  }
}
