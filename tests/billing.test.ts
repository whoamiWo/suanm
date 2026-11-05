/**
 * 计费核心测试。
 *
 * 覆盖三个关键不变式：
 * 1. 兑换码不可重放（并发核销只成功一次）
 * 2. 扣费幂等（同一 idempotencyKey 只扣一次）
 * 3. 额度不足时拒绝扣费（不产生负向流水）
 *
 * 运行前需启动数据库：docker compose up -d
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, getPool } from '@/lib/db/client';
import {
  billingAccounts,
  billingLedger,
  redemptionCodes,
  subscriptionPlans,
  subscriptionPlanLimits,
  userSubscriptionLimits,
  userSubscriptions,
} from '@/lib/db/schema';
import { redeemCode, RedeemError } from '@/lib/billing/redeem';
import { consume, getBalance, InsufficientBalanceError } from '@/lib/billing/consume';
import { creditsToMicros, microsToCredits, yuanToMicros } from '@/lib/billing/credits';

const userId = randomUUID();
/** 每个用例独立用户，避免额度相互影响 */
const newUser = () => randomUUID();

beforeAll(async () => {
  // 清理上次运行的残留，保证可重复执行（按外键依赖顺序删除）
  const db = getDb();
  await db.delete(redemptionCodes).where(eq(redemptionCodes.code, 'TEST-BALANCE-001'));
  await db.delete(redemptionCodes).where(eq(redemptionCodes.code, 'TEST-PLAN-001'));
  await db.delete(redemptionCodes).where(eq(redemptionCodes.code, 'TEST-RACE-001'));
  for (const code of ['TEST-PLAN-A', 'TEST-PLAN-B', 'TEST-PLAN-C']) {
    await db.delete(redemptionCodes).where(eq(redemptionCodes.code, code));
  }
  const stalePlans = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.title, '测试月卡'));
  for (const plan of stalePlans) {
    const staleSubs = await db
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.planId, plan.id));
    for (const sub of staleSubs) {
      await db
        .delete(userSubscriptionLimits)
        .where(eq(userSubscriptionLimits.subscriptionId, sub.id));
    }
    await db.delete(userSubscriptions).where(eq(userSubscriptions.planId, plan.id));
    await db
      .delete(subscriptionPlanLimits)
      .where(eq(subscriptionPlanLimits.planId, plan.id));
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, plan.id));
  }

  // 准备测试数据
  await db.insert(subscriptionPlans).values({
    title: '测试月卡',
    priceCny: '19.00',
    durationUnit: 'month',
    durationValue: 1,
  });
  const plan = await db.select().from(subscriptionPlans).limit(1);
  await db.insert(subscriptionPlanLimits).values({
    planId: plan[0].id,
    period: 'monthly',
    allowanceMicros: creditsToMicros(100),
  });
  await db.insert(redemptionCodes).values([
    {
      code: 'TEST-BALANCE-001',
      kind: 'balance',
      amountMicros: yuanToMicros(10),
      status: 'unused',
    },
    {
      code: 'TEST-PLAN-001',
      kind: 'subscription',
      planId: plan[0].id,
      status: 'unused',
    },
    // 额度扣减用例各自独立的套餐码
    ...['TEST-PLAN-A', 'TEST-PLAN-B', 'TEST-PLAN-C'].map((code) => ({
      code,
      kind: 'subscription' as const,
      planId: plan[0].id,
      status: 'unused' as const,
    })),
  ]);
});

afterAll(async () => {
  await getPool().end();
});

describe('代金卷换算', () => {
  it('1 元 = 23 代金卷', () => {
    expect(yuanToMicros(1)).toBe(23 * 1_000_000);
  });
  it('micros 与代金卷互转正确', () => {
    expect(microsToCredits(creditsToMicros(25))).toBe(25);
  });
});

describe('兑换码核销', () => {
  it('余额码可核销并写入流水', async () => {
    const u = newUser();
    const r = await redeemCode('TEST-BALANCE-001', u);
    expect(r.kind).toBe('balance');
    expect(r.amountMicros).toBe(yuanToMicros(10));

    const bal = await getBalance(u);
    expect(bal.walletMicros).toBe(yuanToMicros(10));
  });

  it('同一兑换码不可重复核销', async () => {
    await expect(redeemCode('TEST-BALANCE-001', userId)).rejects.toThrow(RedeemError);
  });

  it('套餐码可开通订阅并发放额度', async () => {
    const u = newUser();
    const r = await redeemCode('TEST-PLAN-001', u);
    expect(r.kind).toBe('subscription');
    expect(r.subscriptionId).toBeTruthy();

    const bal = await getBalance(u);
    expect(microsToCredits(bal.subscriptionMicros)).toBe(100);
  });

  it('不存在的兑换码报 NOT_FOUND', async () => {
    await expect(redeemCode('NOT-EXIST-CODE', userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('并发核销只成功一次', async () => {
    const db = getDb();
    await db.insert(redemptionCodes).values({
      code: 'TEST-RACE-001',
      kind: 'balance',
      amountMicros: yuanToMicros(5),
      status: 'unused',
    });
    const u = newUser();
    const results = await Promise.allSettled([
      redeemCode('TEST-RACE-001', u),
      redeemCode('TEST-RACE-001', u),
      redeemCode('TEST-RACE-001', u),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(failed).toBe(2);
  });
});

describe('额度扣减', () => {
  it('订阅额度优先扣，够用时不扣钱包', async () => {
    const u = newUser();
    await redeemCode('TEST-PLAN-A', u);
    const before = await getBalance(u);
    await consume(u, creditsToMicros(10), {
      idempotencyKey: `consume-001-${u}`,
      description: '测试扣费',
    });
    const after = await getBalance(u);
    expect(microsToCredits(after.subscriptionMicros)).toBe(
      microsToCredits(before.subscriptionMicros) - 10,
    );
    expect(after.walletMicros).toBe(before.walletMicros);
  });

  it('同一幂等键只扣一次', async () => {
    const u = newUser();
    await redeemCode('TEST-PLAN-B', u);
    const before = await getBalance(u);
    await consume(u, creditsToMicros(5), { idempotencyKey: `consume-idem-${u}` });
    await consume(u, creditsToMicros(5), { idempotencyKey: `consume-idem-${u}` });
    const after = await getBalance(u);
    expect(microsToCredits(before.subscriptionMicros) - microsToCredits(after.subscriptionMicros)).toBe(5);
  });

  it('完全无可用额度时抛错且不写流水', async () => {
    const db = getDb();
    const emptyUser = randomUUID();
    const beforeCount = (await db.select().from(billingLedger)).length;
    await expect(
      consume(emptyUser, creditsToMicros(1), {
        idempotencyKey: `consume-fail-${emptyUser}`,
      }),
    ).rejects.toThrow(InsufficientBalanceError);
    const afterCount = (await db.select().from(billingLedger)).length;
    expect(afterCount).toBe(beforeCount);
  });

  it('有可用额度时钱包可被扣成负数（不阻断服务）', async () => {
    const db = getDb();
    const emptyUser = randomUUID();
    await db.insert(billingAccounts).values({
      userId: emptyUser,
      balanceMicros: creditsToMicros(1),
    });
    await consume(emptyUser, creditsToMicros(10), {
      idempotencyKey: `consume-negative-${emptyUser}`,
    });
    const acc = await db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.userId, emptyUser));
    expect(acc[0].balanceMicros).toBe(creditsToMicros(1) - creditsToMicros(10));
  });
});
