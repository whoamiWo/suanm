import { calculateQimen, toQimenJson, toQimenText } from 'taibu-core/qimen';
import { calculateMeihua, toMeihuaJson, toMeihuaText } from 'taibu-core/meihua';
import {
  calculateLiuyao,
  toLiuyaoCanonicalJson,
  toLiuyaoCanonicalText,
} from 'taibu-core/liuyao';
import {
  calculateDaliuren,
  toDaliurenJson,
  toDaliurenText,
} from 'taibu-core/daliuren';
import {
  calculateXiaoliurenData,
  toXiaoliurenJson,
  toXiaoliurenText,
} from 'taibu-core/xiaoliuren';
import { calculateDailyAlmanac, toAlmanacJson, toAlmanacText } from 'taibu-core/almanac';
import type { ChartResult } from './types';
import { wrapError } from './bazi';

/**
 * 占卜类与历法类术数适配。
 *
 * 这类方法不依赖出生时间，以「问事时间」或「起卦方式」为输入。
 * 注意：奇门与六爻的上游计算为异步（涉及天文计算），故返回 Promise。
 */

/** 问事时间输入 */
export interface DivinationInput {
  /** 问事日期 YYYY-MM-DD */
  date: string;
  /** 问事小时 0-23 */
  hour: number;
  /** 问事分钟 */
  minute?: number;
  /** 所问之事 */
  question?: string;
  timezone?: string;
}

/** 奇门选项 */
export interface QimenOptions extends DivinationInput {
  panType?: 'zhuan' | 'fei';
  /** 定局法：拆补 / 茅山 / 节气三等分 */
  juMethod?: 'chaibu' | 'maoshan' | 'equal';
}

/** 梅花选项 */
export interface MeihuaOptions extends DivinationInput {
  method?: 'time' | 'count_with_time' | 'text_split' | 'number_pair' | 'number_triplet';
  count?: number;
  text?: string;
  numbers?: number[];
  majorValue?: number;
  minorValue?: number;
}

/** 六爻选项 */
export interface LiuyaoOptions extends DivinationInput {
  method?: 'auto' | 'select' | 'time' | 'number' | 'coins' | 'yarrow';
  yongShenTargets?: Array<'父母' | '兄弟' | '子孙' | '妻财' | '官鬼'>;
  /** 手工六爻值（初爻到上爻，6-9） */
  yaoValues?: number[];
  hexagramName?: string;
  changedHexagramName?: string;
  numbers?: number[];
}

/** 大六壬选项 */
export interface DaliurenOptions extends DivinationInput {
  /** 出生年（用于本命与行年） */
  birthYear?: number;
  gender?: 'male' | 'female';
  /** 手工月将 */
  monthGeneral?: string;
}

/** 小六壬选项 */
export interface XiaoliurenOptions {
  date?: string;
  hour: number;
  hourType?: 'clock' | 'shichen' | 'legacy';
  question?: string;
}

/** 黄历选项 */
export interface AlmanacOptions {
  date?: string;
  timezone?: string;
  dayMaster?: string;
}


/**
 * 构造含时间的 ISO 字符串。
 *
 * 梅花与六爻的上游要求 date 含时间（YYYY-MM-DDTHH:MM[:SS]），
 * 而黄历/奇门只需日期。此处统一处理。
 */
function toIsoDateTime(date: string, hour = 0, minute = 0): string {
  if (date.includes('T')) return date;
  const d = date.length >= 10 ? date.slice(0, 10) : date;
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${d}T${h}:${m}:00`;
}

/** 奇门遁甲 */
export async function runQimen(options: QimenOptions): Promise<ChartResult> {
  try {
    const chart = await calculateQimen({
      year: Number(options.date.slice(0, 4)),
      month: Number(options.date.slice(5, 7)),
      day: Number(options.date.slice(8, 10)),
      hour: options.hour,
      minute: options.minute ?? 0,
      timezone: options.timezone,
      question: options.question,
      panType: options.panType,
      juMethod: options.juMethod,
    });
    return {
      method: 'qimen',
      text: toQimenText(chart),
      json: toQimenJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'qimen');
  }
}

/** 梅花易数 */
export async function runMeihua(options: MeihuaOptions): Promise<ChartResult> {
  try {
    const chart = await calculateMeihua({
      question: options.question ?? '',
      date: toIsoDateTime(options.date, options.hour, options.minute),
      method: options.method,
      count: options.count,
      text: options.text,
      numbers: options.numbers,
      majorValue: options.majorValue,
      minorValue: options.minorValue,
    });
    return {
      method: 'meihua',
      text: toMeihuaText(chart),
      json: toMeihuaJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'meihua');
  }
}

/** 六爻 */
export async function runLiuyao(options: LiuyaoOptions): Promise<ChartResult> {
  try {
    const chart = await calculateLiuyao({
      question: options.question ?? '',
      // 上游要求至少一个分析目标，缺省时给出通用六亲组
      yongShenTargets:
        options.yongShenTargets && options.yongShenTargets.length > 0
          ? options.yongShenTargets
          : (['官鬼', '妻财', '子孙', '父母', '兄弟'] as const).slice(),

      method: options.method,
      yaoValues: options.yaoValues,
      date: toIsoDateTime(options.date, options.hour, options.minute),
      timezone: options.timezone,
      hexagramName: options.hexagramName,
      changedHexagramName: options.changedHexagramName,
      numbers: options.numbers,
    });
    return {
      method: 'liuyao',
      text: toLiuyaoCanonicalText(chart),
      json: toLiuyaoCanonicalJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'liuyao');
  }
}

/** 大六壬 */
export async function runDaliuren(options: DaliurenOptions): Promise<ChartResult> {
  try {
    const chart = await calculateDaliuren({
      date: options.date,
      hour: options.hour,
      minute: options.minute ?? 0,
      timezone: options.timezone,
      question: options.question,
      birthYear: options.birthYear,
      gender: options.gender,
      monthGeneral: options.monthGeneral,
    });
    return {
      method: 'daliuren',
      text: toDaliurenText(chart),
      json: toDaliurenJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'daliuren');
  }
}

/** 小六壬 */
export async function runXiaoliuren(options: XiaoliurenOptions): Promise<ChartResult> {
  try {
    const chart = await calculateXiaoliurenData({
      date: options.date,
      hour: options.hour,
      hourType: options.hourType,
      question: options.question,
    });
    return {
      method: 'xiaoliuren',
      text: toXiaoliurenText(chart),
      json: toXiaoliurenJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'xiaoliuren');
  }
}

/** 黄历 */
export async function runAlmanac(options: AlmanacOptions): Promise<ChartResult> {
  try {
    const chart = await calculateDailyAlmanac({
      date: options.date,
      timezone: options.timezone,
      dayMaster: options.dayMaster,
    });
    return {
      method: 'almanac',
      text: toAlmanacText(chart),
      json: toAlmanacJson(chart) as unknown as Record<string, unknown>,
    };
  } catch (err) {
    throw wrapError(err, 'almanac');
  }
}
