import {
  calculateBazi,
  toBaziJson,
  toBaziText,
  type BaziInput,
} from 'taibu-core/bazi';
import {
  calculateBaziDayun,
  toBaziDayunJson,
  toBaziDayunText,
} from 'taibu-core/bazi-dayun';
import {
  ChartError,
  type BirthInput,
  type ChartMethod,
  type ChartResult,
  type PillarInfo,
} from './types';

/**
 * 八字排盘适配层。
 *
 * taibu-core 的 BaziInput 不接受 undefined 的 birthHour（时辰未知），
 * 这里按 ALGORITHM_RULES 的约定做分支：时辰未知时只排年、月、日三柱。
 */

/** 允许 birthHour 缺省的上游输入类型 */
type BaziInputLoose = Omit<BaziInput, 'birthHour'> & { birthHour?: number };

function toUpstream(input: BirthInput): BaziInputLoose {
  const out: BaziInputLoose = {
    gender: input.gender,
    birthYear: input.birthYear,
    birthMonth: input.birthMonth,
    birthDay: input.birthDay,
  };
  if (input.birthHour !== undefined) out.birthHour = input.birthHour;
  if (input.birthMinute !== undefined) out.birthMinute = input.birthMinute;
  if (input.calendarType) out.calendarType = input.calendarType;
  if (input.isLeapMonth !== undefined) out.isLeapMonth = input.isLeapMonth;
  if (input.longitude !== undefined) out.longitude = input.longitude;
  if (input.birthPlace) out.birthPlace = input.birthPlace;
  if (input.timezone) out.timezone = input.timezone;
  if (input.dayBoundary) out.dayBoundary = input.dayBoundary;
  if (input.disambiguation) out.disambiguation = input.disambiguation;
  return out;
}

/**
 * 提取四柱摘要为稳定的英文结构。
 *
 * 上游 BaziOutput 用四个字段表示四柱，这里归一为数组，
 * 时辰未知时数组长度为 3。
 */
function extractPillars(chart: {
  fourPillars: Record<string, { stem: string; branch: string; tenGod?: string; naYin?: string; diShi?: string }>;
}): Array<PillarInfo | null> {
  const fp = chart.fourPillars;
  const pick = (
    key: 'year' | 'month' | 'day' | 'hour',
    position: string,
  ): PillarInfo | null => {
    const p = fp[key];
    if (!p) return null;
    return {
      position,
      ganZhi: `${p.stem}${p.branch}`,
      tenGod: p.tenGod,
      naYin: p.naYin,
      diShi: p.diShi,
    };
  };
  return [
    pick('year', '年柱'),
    pick('month', '月柱'),
    pick('day', '日柱'),
    pick('hour', '时柱'),
  ].filter((p): p is PillarInfo => p !== null);
}

export function runBazi(input: BirthInput): ChartResult {
  try {
    const upstream = toUpstream(input);
    const chart = calculateBazi(upstream);
    const json = toBaziJson(chart) as unknown as Record<string, unknown>;
    const text = toBaziText(chart);
    return {
      method: 'bazi',
      text,
      json,
      pillars: extractPillars(chart),
      trueSolarTime: chart.trueSolarTimeInfo,
      rules: (chart.calculationOptions ?? {}) as Record<string, unknown>,
      warnings: extractWarnings(chart),
    };
  } catch (err) {
    throw wrapError(err, 'bazi');
  }
}

/** 大运 / 流年链路 */
export function runBaziDayun(input: BirthInput): ChartResult {
  try {
    const upstream = toUpstream(input) as BaziInput;
    const chart = calculateBaziDayun(upstream);
    return {
      method: 'bazi-dayun',
      text: toBaziDayunText(chart),
      json: toBaziDayunJson(chart) as unknown as Record<string, unknown>,
      rules: (chart.calculationOptions ?? {}) as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'bazi-dayun');
  }
}

/** 提取上游 warnings（神煞与流年可能附带） */
function extractWarnings(chart: unknown): string[] | undefined {
  const w = (chart as { warnings?: unknown }).warnings;
  return Array.isArray(w) && w.length > 0 ? (w as string[]) : undefined;
}

/** 将上游异常包装为统一错误码 */
export function wrapError(err: unknown, method: string): ChartError {
  if (err instanceof ChartError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  // 上游以「不支持的分支」「没有实现」等方式拒绝时归为 UNSUPPORTED
  if (
    lower.includes('not supported') ||
    lower.includes('unsupported') ||
    lower.includes('未实现') ||
    lower.includes('不支持')
  ) {
    return new ChartError('UNSUPPORTED', msg, { method });
  }
  // 输入校验类
  if (
    lower.includes('invalid') ||
    lower.includes('must be') ||
    lower.includes('required') ||
    lower.includes('无效') ||
    lower.includes('不能')
  ) {
    return new ChartError('VALIDATION', msg, { method });
  }
  // 历法边界（交节当天、越界年份等）
  if (
    lower.includes('boundary') ||
    lower.includes('range') ||
    lower.includes('out of') ||
    lower.includes('边界')
  ) {
    return new ChartError('BOUNDARY', msg, { method });
  }
  return new ChartError('INTERNAL', msg, { method });
}

export const baziMethod: ChartMethod = {
  id: 'bazi',
  name: '八字排盘',
  description: '四柱八字，含真太阳时校正、两种日界与时辰未知三柱模式',
  requiresBirth: true,
};
