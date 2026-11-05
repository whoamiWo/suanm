import { z } from 'zod';
import { ChartError, type BirthInput } from './types';

/**
 * 排盘入参校验。
 *
 * 边界依据 taibu-core 的 ALGORITHM_RULES：
 * - 紫微与奇门限制在 1900–2100 年
 * - 公历年份合法范围 1–9999，但排盘业务上取 1900–2100
 */

/** 排盘支持的公历年份范围 */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export const birthInputSchema = z
  .object({
    birthYear: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
    birthMonth: z.number().int().min(1).max(12),
    birthDay: z.number().int().min(1).max(31),
    birthHour: z.number().int().min(0).max(23).optional(),
    birthMinute: z.number().int().min(0).max(59).optional(),
    gender: z.enum(['male', 'female']),
    calendarType: z.enum(['solar', 'lunar']).optional(),
    isLeapMonth: z.boolean().optional(),
    longitude: z.number().min(-180).max(180).optional(),
    birthPlace: z.string().max(120).optional(),
    timezone: z.string().max(64).optional(),
    dayBoundary: z.enum(['midnight', 'zi']).optional(),
    disambiguation: z.enum(['reject', 'earlier', 'later', 'compatible']).optional(),
  });

/** 校验并归一化入参 */
export function parseBirthInput(raw: unknown): BirthInput {
  const parsed = birthInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ChartError('VALIDATION', '出生信息校验失败', {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  const v = parsed.data;
  // 时辰未知时忽略分钟：上游不接受「无时却有分」的输入，
  // 这里在解析层归一，避免把调用方的粗心变成校验错误。
  if (v.birthHour === undefined) {
    return {
      birthYear: v.birthYear,
      birthMonth: v.birthMonth,
      birthDay: v.birthDay,
      gender: v.gender,
      calendarType: v.calendarType,
      isLeapMonth: v.isLeapMonth,
      longitude: v.longitude,
      birthPlace: v.birthPlace,
      timezone: v.timezone,
      dayBoundary: v.dayBoundary,
      disambiguation: v.disambiguation,
    };
  }
  return { ...v, birthHour: v.birthHour };
}

/**
 * 占卜类方法的入参校验。
 *
 * 占卜不依赖出生时间，只需问事时间与所问之事。
 */
export const divinationInputSchema = z.object({
  /** 问事日期 YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  /** 问事小时 0-23 */
  hour: z.number().int().min(0).max(23),
  /** 问事分钟 */
  minute: z.number().int().min(0).max(59).optional(),
  /** 所问之事 */
  question: z.string().max(500).optional(),
  timezone: z.string().max(64).optional(),
});

export function parseDivinationInput(raw: unknown): Record<string, unknown> {
  const parsed = divinationInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ChartError('VALIDATION', '问事信息校验失败', {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  return parsed.data;
}
