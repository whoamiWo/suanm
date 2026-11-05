import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUser } from './auth';

/**
 * 计费相关表。
 *
 * 设计依据（借鉴 taibu 生产级 schema，已验证）：
 * - 金额一律用 bigint micros（百万分之一）存整数，杜绝浮点误差。
 * - 双额度池：billing_accounts 为钱包（永续），user_subscriptions 为订阅（按周期刷新）。
 * - billing_ledger 为唯一事实来源，所有增减都写流水，带幂等键。
 * - 扣费顺序由 billing_accounts.deduct_order 决定：先订阅额度，再钱包。
 */

export const billingAccounts = pgTable('billing_accounts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  /** 钱包余额，单位 micros */
  balanceMicros: bigint('balance_micros', { mode: 'number' }).notNull().default(0),
  /** 扣费顺序：subscription 优先还是 wallet 优先 */
  deductOrder: text('deduct_order', { enum: ['subscription', 'wallet'] })
    .notNull()
    .default('subscription'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const billingLedger = pgTable(
  'billing_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['usage', 'refund', 'topup', 'subscription', 'redeem', 'adjust'],
    }).notNull(),
    /** 本次变动金额（micros），退款为正 */
    amountMicros: bigint('amount_micros', { mode: 'number' }).notNull(),
    /** 变动后钱包余额快照 */
    walletMicros: bigint('wallet_micros', { mode: 'number' }).notNull().default(0),
    /** 本次消耗的订阅额度明细（JSON） */
    subscriptionParts: jsonb('subscription_parts')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** 幂等键，防止重复扣费 */
    idempotencyKey: text('idempotency_key'),
    /** 计费模型标识（如 gpt-4o-mini） */
    modelKey: text('model_key'),
    /** 用量明细（token 数等） */
    usage: jsonb('usage'),
    source: text('source').notNull().default(''),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('billing_ledger_idempotency_key_uq').on(t.idempotencyKey),
    index('billing_ledger_user_idx').on(t.userId, t.createdAt),
  ],
);

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  /** 套餐特性文案列表 */
  features: text('features')
    .notNull()
    .default(sql`'{}'::text[]`),
  /** 售价（人民币元），仅展示用；实际扣减走 allowance_micros */
  priceCny: numeric('price_cny', { precision: 10, scale: 2 }).notNull().default('0'),
  durationUnit: text('duration_unit', { enum: ['day', 'month', 'year'] })
    .notNull()
    .default('month'),
  durationValue: integer('duration_value').notNull().default(1),
  /** 每用户限购数，null 表示不限 */
  maxPerUser: integer('max_per_user'),
  purchasable: integer('purchasable').notNull().default(1),
  enabled: integer('enabled').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 套餐额度窗口 */
export const subscriptionPlanLimits = pgTable(
  'subscription_plan_limits',
  {
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
    period: text('period', {
      enum: ['five_hour', 'daily', 'weekly', 'monthly', 'total'],
    }).notNull(),
    /** 每周期额度（micros） */
    allowanceMicros: bigint('allowance_micros', { mode: 'number' }).notNull(),
  },
  (t) => [index('subscription_plan_limits_plan_idx').on(t.planId)],
);

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: text('status', { enum: ['active', 'cancelled', 'expired'] })
      .notNull()
      .default('active'),
    /** 来源：兑换码 / 支付 / 管理员 / 余额购买 */
    source: text('source', { enum: ['redeem', 'epay', 'admin', 'balance'] }).notNull(),
    orderId: uuid('order_id'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_subscriptions_user_idx').on(t.userId, t.status),
    index('user_subscriptions_ends_idx').on(t.endsAt),
  ],
);

/** 用户订阅的额度使用情况（按周期惰性重置） */
export const userSubscriptionLimits = pgTable(
  'user_subscription_limits',
  {
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => userSubscriptions.id, { onDelete: 'cascade' }),
    period: text('period', {
      enum: ['five_hour', 'daily', 'weekly', 'monthly', 'total'],
    }).notNull(),
    allowanceMicros: bigint('allowance_micros', { mode: 'number' }).notNull(),
    usedMicros: bigint('used_micros', { mode: 'number' }).notNull().default(0),
    nextResetAt: timestamp('next_reset_at', { withTimezone: true }),
  },
  (t) => [index('user_subscription_limits_sub_idx').on(t.subscriptionId)],
);

export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeNo: text('trade_no').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['topup', 'subscription'] }).notNull(),
    planId: uuid('plan_id').references(() => subscriptionPlans.id),
    /** 购买获得的额度（micros） */
    creditMicros: bigint('credit_micros', { mode: 'number' }),
    payAmount: numeric('pay_amount', { precision: 12, scale: 2 }).notNull(),
    payCurrency: text('pay_currency').notNull().default('CNY'),
    /** 支付渠道：epay / wechat / alipay / redeem */
    provider: text('provider', { enum: ['epay', 'wechat', 'alipay', 'redeem'] })
      .notNull()
      .default('epay'),
    payMethod: text('pay_method'),
    status: text('status', { enum: ['pending', 'paid', 'expired', 'failed'] })
      .notNull()
      .default('pending'),
    providerTradeNo: text('provider_trade_no'),
    providerPayload: jsonb('provider_payload'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payment_orders_trade_no_uq').on(t.tradeNo),
    index('payment_orders_user_idx').on(t.userId, t.createdAt),
  ],
);

/** 兑换码：支持「充余额」与「直接开通套餐」两种形态 */
export const redemptionCodes = pgTable(
  'redemption_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 兑换码明文 */
    code: text('code').notNull(),
    kind: text('kind', { enum: ['balance', 'subscription'] }).notNull(),
    /** kind=balance 时的充值额度（micros） */
    amountMicros: bigint('amount_micros', { mode: 'number' }),
    /** kind=subscription 时对应的套餐 */
    planId: uuid('plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['unused', 'used', 'disabled'] })
      .notNull()
      .default('unused'),
    /** 核销人，指向 auth_user */
    usedBy: uuid('used_by').references(() => authUser.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** 批次备注，便于运营按批次导出与追溯 */
    batchNote: text('batch_note'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('redemption_codes_code_uq').on(t.code),
    index('redemption_codes_status_idx').on(t.status, t.kind),
  ],
);
