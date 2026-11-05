import { baziMethod, runBazi, runBaziDayun } from './bazi';
import { ziweiMethod, runZiwei, type ZiweiOptions } from './ziwei';
import {
  runAlmanac,
  runDaliuren,
  runLiuyao,
  runMeihua,
  runQimen,
  runXiaoliuren,
  type AlmanacOptions,
  type DaliurenOptions,
  type LiuyaoOptions,
  type MeihuaOptions,
  type QimenOptions,
  type XiaoliurenOptions,
} from './divination';
import { ChartError, type BirthInput, type ChartMethod, type ChartResult } from './types';

/**
 * 术数方法注册表。
 *
 * 自研模块（姓名学、八宅等）实现 ChartMethod 后在此登记即可被 API 与页面调用，
 * 上游 taibu-core 的变更被限制在 bazi.ts / ziwei.ts / divination.ts 三个适配文件内。
 */

export interface MethodEntry {
  method: ChartMethod;
  /** 执行入口。返回 Promise 表示上游计算为异步（涉及天文计算）。 */
  exec: (
    input: BirthInput,
    options?: Record<string, unknown>,
  ) => ChartResult | Promise<ChartResult>;
}

export const METHODS: Record<string, MethodEntry> = {
  bazi: {
    method: baziMethod,
    exec: (input) => runBazi(input),
  },
  'bazi-dayun': {
    method: {
      ...baziMethod,
      id: 'bazi-dayun',
      name: '大运流年',
      description: '起运、大运、流年与流月流日链路',
    },
    exec: (input) => runBaziDayun(input),
  },
  ziwei: {
    method: ziweiMethod,
    exec: (input, options) => runZiwei(input, (options ?? {}) as ZiweiOptions),
  },
  qimen: {
    method: {
      id: 'qimen',
      name: '奇门遁甲',
      description: '九宫天地盘、值符值使、格局与旺衰，支持转盘飞盘与三种定局法',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runQimen({ ...input, ...(options ?? {}) } as unknown as QimenOptions),
  },
  meihua: {
    method: {
      id: 'meihua',
      name: '梅花易数',
      description: '以时间、数字、声响等起卦，判体用生克与互变',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runMeihua({ ...input, ...(options ?? {}) } as unknown as MeihuaOptions),
  },
  liuyao: {
    method: {
      id: 'liuyao',
      name: '六爻',
      description: '纳甲六亲六神、伏神动变与用神旺衰，支持硬币与蓍草起卦',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runLiuyao({ ...input, ...(options ?? {}) } as unknown as LiuyaoOptions),
  },
  daliuren: {
    method: {
      id: 'daliuren',
      name: '大六壬',
      description: '四课三传、月将贵人天将与神煞课体',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runDaliuren({ ...input, ...(options ?? {}) } as unknown as DaliurenOptions),
  },
  xiaoliuren: {
    method: {
      id: 'xiaoliuren',
      name: '小六壬',
      description: '大安留连速喜赤口小吉空亡六宫递推占测',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runXiaoliuren({ ...input, ...(options ?? {}) } as unknown as XiaoliurenOptions),
  },
  almanac: {
    method: {
      id: 'almanac',
      name: '黄历',
      description: '每日干支、宜忌、冲煞、值神与吉神凶煞',
      requiresBirth: false,
    },
    exec: (input, options) =>
      runAlmanac({ ...input, ...(options ?? {}) } as unknown as AlmanacOptions),
  },
};

/** 方法列表（供前端选择与 SEO 页面生成） */
export function listMethods() {
  return Object.values(METHODS).map((entry) => ({
    id: entry.method.id,
    name: entry.method.name,
    description: entry.method.description,
    requiresBirth: entry.method.requiresBirth,
  }));
}

/**
 * 按方法 id 执行排盘。
 * @throws ChartError 方法不存在或执行失败
 */
export async function runChart(
  methodId: string,
  input: BirthInput,
  options?: Record<string, unknown>,
): Promise<ChartResult> {
  const entry = METHODS[methodId];
  if (!entry) {
    throw new ChartError('UNSUPPORTED', `未知的排盘方法: ${methodId}`, { methodId });
  }
  return entry.exec(input, options);
}
