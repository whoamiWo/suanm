/**
 * 排盘方法元数据。
 *
 * 与 registry.ts 的 METHODS 保持一致，此处为纯数据，供客户端组件使用
 * （registry.ts 依赖服务端专用的 taibu-core，不能引入客户端）。
 */

export interface MethodMeta {
  id: string;
  name: string;
  description: string;
  requiresBirth: boolean;
  /** 该方法是否为占卜类（不需要出生时间） */
  isDivination?: boolean;
}

export const METHODS: MethodMeta[] = [
  {
    id: 'bazi',
    name: '八字排盘',
    description: '四柱八字，含真太阳时校正、两种日界与时辰未知三柱模式',
    requiresBirth: true,
  },
  {
    id: 'bazi-dayun',
    name: '大运流年',
    description: '起运、大运、流年与流月流日链路',
    requiresBirth: true,
  },
  {
    id: 'ziwei',
    name: '紫微斗数',
    description: '十二宫命盘，含大限、小限与四化，支持中州派算法',
    requiresBirth: true,
  },
  // 占卜类方法（不需要出生时间）
  {
    id: 'qimen',
    name: '奇门遁甲',
    description: '九宫天地盘、值符值使、格局与旺衰，支持转盘飞盘与三种定局法',
    requiresBirth: false,
  },
  {
    id: 'meihua',
    name: '梅花易数',
    description: '以时间、数字、声响等起卦，判体用生克与互变',
    requiresBirth: false,
  },
  {
    id: 'liuyao',
    name: '六爻',
    description: '纳甲六亲六神、伏神动变与用神旺衰，支持硬币与蓍草起卦',
    requiresBirth: false,
  },
  {
    id: 'daliuren',
    name: '大六壬',
    description: '四课三传、月将贵人天将与神煞课体',
    requiresBirth: false,
  },
  {
    id: 'xiaoliuren',
    name: '小六壬',
    description: '大安留连速喜赤口小吉空亡六宫递推占测',
    requiresBirth: false,
  },
  {
    id: 'almanac',
    name: '黄历',
    description: '每日干支、宜忌、冲煞、值神与吉神凶煞',
    requiresBirth: false,
  },
];

export const METHOD_MAP: Record<string, MethodMeta> = Object.fromEntries(
  METHODS.map((m) => [m.id, m]),
);
