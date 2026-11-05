import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUser } from './auth';


/**
 * 出生档案。
 *
 * 出生信息属敏感个人信息：
 * - birthPlace / longitude 仅为真太阳时校正所需，可留空
 * - 后续接入账号体系时，本表需按用户隔离并支持导出/删除
 */
export const birthProfiles = pgTable(
  'birth_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    /** 用户自定义标签，如「本人」「客户 A」 */
    label: text('label').notNull().default(''),
    calendarType: text('calendar_type', { enum: ['solar', 'lunar'] })
      .notNull()
      .default('solar'),
    birthYear: integer('birth_year').notNull(),
    birthMonth: integer('birth_month').notNull(),
    birthDay: integer('birth_day').notNull(),
    /** 出生时，null 表示时辰未知 */
    birthHour: integer('birth_hour'),
    birthMinute: integer('birth_minute'),
    gender: text('gender', { enum: ['male', 'female'] }).notNull(),
    isLeapMonth: integer('is_leap_month').notNull().default(0),
    birthPlace: text('birth_place'),
    longitude: integer('longitude_micros'),
    timezone: text('timezone').notNull().default('Asia/Shanghai'),
    dayBoundary: text('day_boundary', { enum: ['midnight', 'zi'] })
      .notNull()
      .default('midnight'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('birth_profiles_user_idx').on(t.userId)],
);

/**
 * 排盘结果。
 *
 * inputHash 为输入的稳定摘要，用于缓存与去重（同参数不重复计算）。
 */
export const chartResults = pgTable(
  'chart_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 匿名排盘不入库，故可为空 */
    userId: uuid('user_id').references(() => authUser.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    /** 输入参数摘要，用于缓存命中 */
    inputHash: text('input_hash').notNull(),
    /** 归一化后的输入，用于复现 */
    input: jsonb('input').notNull(),
    /** 结构化盘面 */
    canonicalJson: jsonb('canonical_json').notNull(),
    /** 规范文本 */
    textOutput: text('text_output').notNull(),
    /** 计算口径快照 */
    rules: jsonb('rules'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('chart_results_method_input_uq').on(t.method, t.inputHash),
    index('chart_results_user_idx').on(t.userId, t.createdAt),
  ],
);

/**
 * AI 解读报告。
 *
 * tier 区分免费规则摘要与付费 LLM 报告，costMicros 记录实际模型成本。
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    chartId: uuid('chart_id').notNull().references(() => chartResults.id),
    /** 报告档位 */
    tier: text('tier', { enum: ['summary', 'standard', 'detailed', 'deep'] })
      .notNull()
      .default('summary'),
    /** 模型标识 */
    model: text('model'),
    /** 提示词版本，便于回溯与效果对比 */
    promptVersion: text('prompt_version'),
    /** Markdown 正文 */
    contentMd: text('content_md').notNull(),
    /** token 用量 */
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** 本次消耗的额度（micros） */
    costMicros: bigint('cost_micros', { mode: 'number' }),
    status: text('status', { enum: ['pending', 'done', 'failed'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reports_user_idx').on(t.userId, t.createdAt)],
);
