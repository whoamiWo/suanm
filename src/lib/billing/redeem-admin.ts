import { randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { redemptionCodes } from '@/lib/db/schema';
import { creditsToMicros } from './credits';

/**
 * 兑换码生成（运营后台用）。
 *
 * 批量生成后按批次导出，供线下分发或作为分销商供货。
 */

export interface BatchOptions {
  /** 批次备注 */
  batchNote?: string;
  /** 有效期 */
  expiresAt?: Date;
  /** 运营操作人 id */
  createdBy?: string;
}

/** 生成不易混淆的随机码 */
function generateCode(): string {
  // 去掉 0/O/1/I/L 等易混字符
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

/** 批量生成余额型兑换码 */
export async function generateBalanceCodes(
  count: number,
  creditsPerCode: number,
  options: BatchOptions = {},
): Promise<string[]> {
  const db = getDb();
  const amountMicros = creditsToMicros(creditsPerCode);
  const codes: string[] = [];
  const rows = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    codes.push(code);
    rows.push({
      code,
      kind: 'balance' as const,
      amountMicros,
      status: 'unused' as const,
      expiresAt: options.expiresAt ?? null,
      batchNote: options.batchNote ?? null,
      createdBy: options.createdBy ?? null,
    });
  }

  await db.insert(redemptionCodes).values(rows);
  return codes;
}

/** 批量生成套餐型兑换码 */
export async function generateSubscriptionCodes(
  count: number,
  planId: string,
  options: BatchOptions = {},
): Promise<string[]> {
  const db = getDb();
  const codes: string[] = [];
  const rows = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    codes.push(code);
    rows.push({
      code,
      kind: 'subscription' as const,
      planId,
      status: 'unused' as const,
      expiresAt: options.expiresAt ?? null,
      batchNote: options.batchNote ?? null,
      createdBy: options.createdBy ?? null,
    });
  }

  await db.insert(redemptionCodes).values(rows);
  return codes;
}

/** 批量停用兑换码 */
export async function disableCodes(codes: string[]): Promise<number> {
  if (codes.length === 0) return 0;
  const db = getDb();
  const rows = await db
    .update(redemptionCodes)
    .set({ status: 'disabled' })
    .where(inArray(redemptionCodes.code, codes))
    .returning({ id: redemptionCodes.id });
  return rows.length;
}

/** 按批次查询兑换码使用情况 */
export async function getBatchStats(batchNote: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(redemptionCodes)
    .where(eq(redemptionCodes.batchNote, batchNote));
  const total = rows.length;
  const used = rows.filter((r) => r.status === 'used').length;
  const disabled = rows.filter((r) => r.status === 'disabled').length;
  return { total, used, disabled, unused: total - used - disabled };
}
