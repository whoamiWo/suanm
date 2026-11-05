import {
  calculateZiwei,
  toZiweiJson,
  toZiweiText,
  type ZiweiInput,
} from 'taibu-core/ziwei';
import { ChartError, type BirthInput, type ChartMethod, type ChartResult } from './types';
import { wrapError } from './bazi';

/**
 * 紫微斗数排盘适配层。
 *
 * 紫微的流派差异集中在 calculationOptions，UI 层需显式暴露，
 * 不做静默默认（依据 ALGORITHM_RULES：不同流派的规则须用显式选项区分）。
 */

/** 紫微流派与口径选项 */
export interface ZiweiOptions {
  /** 排盘算法 */
  algorithm?: 'default' | 'zhongzhou';
  /** 年界 */
  yearDivide?: 'normal' | 'exact';
  /** 运限界 */
  horoscopeDivide?: 'normal' | 'exact';
  /** 年龄界 */
  ageDivide?: 'normal' | 'birthday';
  /** 日界 */
  dayDivide?: 'current' | 'forward';
  /** 是否调整闰月 */
  fixLeap?: boolean;
}

export function runZiwei(input: BirthInput, options: ZiweiOptions = {}): ChartResult {
  if (input.birthHour === undefined) {
    throw new ChartError('VALIDATION', '紫微斗数需要完整的出生时辰', { method: 'ziwei' });
  }
  try {
    const calculationOptions: NonNullable<ZiweiInput['calculationOptions']> = {};
    if (options.algorithm) calculationOptions.algorithm = options.algorithm;
    if (options.yearDivide) calculationOptions.yearDivide = options.yearDivide;
    if (options.horoscopeDivide) calculationOptions.horoscopeDivide = options.horoscopeDivide;
    if (options.ageDivide) calculationOptions.ageDivide = options.ageDivide;
    if (options.dayDivide) calculationOptions.dayDivide = options.dayDivide;
    if (options.fixLeap !== undefined) calculationOptions.fixLeap = options.fixLeap;

    const upstream: ZiweiInput = {
      gender: input.gender,
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      birthDay: input.birthDay,
      birthHour: input.birthHour,
      birthMinute: input.birthMinute ?? 0,
      calendarType: input.calendarType ?? 'solar',
    };
    if (input.isLeapMonth !== undefined) upstream.isLeapMonth = input.isLeapMonth;
    if (input.longitude !== undefined) upstream.longitude = input.longitude;
    if (input.timezone) upstream.timezone = input.timezone;
    if (input.disambiguation) upstream.disambiguation = input.disambiguation;
    if (Object.keys(calculationOptions).length > 0) {
      upstream.calculationOptions = calculationOptions;
    }

    const chart = calculateZiwei(upstream);
    return {
      method: 'ziwei',
      text: toZiweiText(chart),
      json: toZiweiJson(chart) as unknown as Record<string, unknown>,
      rules: (chart.calculationOptions ?? calculationOptions) as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'ziwei');
  }
}

export const ziweiMethod: ChartMethod = {
  id: 'ziwei',
  name: '紫微斗数',
  description: '十二宫命盘，含大限、小限与四化，支持中州派算法',
  requiresBirth: true,
};
