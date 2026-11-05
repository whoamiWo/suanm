/**
 * 术数排盘统一类型。
 *
 * 设计原则（对齐 taibu-core 的 ToolContract 思路）：
 * - 所有排盘方法返回同构结果，前端与上层业务无需感知具体术数。
 * - `text` 为可直接展示的规范文本，`json` 为结构化盘面（供 AI 解读与后续扩展）。
 * - 自研模块（如姓名学、八宅）实现同一契约后即可注册进 REGISTRY。
 */

/** 历法类型 */
export type CalendarType = 'solar' | 'lunar';

/** 性别 */
export type Gender = 'male' | 'female';

/** 日界口径：午夜换日 / 子时（23点）换日 */
export type DayBoundary = 'midnight' | 'zi';

/** 夏令时歧义消解策略 */
export type Disambiguation = 'reject' | 'earlier' | 'later' | 'compatible';

/** 出生时间输入（所有命理类术数共用） */
export interface BirthInput {
  /** 出生年（公历或农历，视 calendarType） */
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  /** 出生时（0-23）。缺省表示时辰未知，仅八字支持三柱 */
  birthHour?: number;
  birthMinute?: number;
  gender: Gender;
  calendarType?: CalendarType;
  /** 农历闰月标记 */
  isLeapMonth?: boolean;
  /** 出生地经度，用于真太阳时校正 */
  longitude?: number;
  /** 出生地名称 */
  birthPlace?: string;
  /** IANA 时区，默认 Asia/Shanghai */
  timezone?: string;
  dayBoundary?: DayBoundary;
  disambiguation?: Disambiguation;
}

/** 四柱信息（稳定的英文结构，供前端与 AI 层使用） */
export interface PillarInfo {
  /** 柱位：年柱 / 月柱 / 日柱 / 时柱 */
  position: string;
  /** 干支，如庚午 */
  ganZhi: string;
  /** 天干十神 */
  tenGod?: string;
  /** 地势（长生十二宫） */
  diShi?: string;
  /** 纳音 */
  naYin?: string;
}

/** 真太阳时校正信息 */
export interface TrueSolarTimeInfo {
  clockTime: string;
  trueSolarTime: string;
  longitude: number;
  correctionMinutes: number;
  trueTimeIndex: number;
  dayOffset: number;
}

/** 排盘结果统一契约 */
export interface ChartResult<T = unknown> {
  /** 术数方法标识，如 bazi / ziwei / liuyao */
  method: string;
  /** 可直接展示的规范文本 */
  text: string;
  /** 结构化盘面（canonical JSON，中文键，供存档与审计） */
  json: T;
  /** 四柱摘要（仅命理类方法提供） */
  pillars?: Array<PillarInfo | null>;
  /** 真太阳时校正信息 */
  trueSolarTime?: TrueSolarTimeInfo;
  /** 计算口径快照，用于复现与审计 */
  rules?: Record<string, unknown>;
  /** 过程中的警告（如边界日期异常） */
  warnings?: string[];
}

/**
 * 术数方法元信息。
 *
 * 执行入口由 registry 的 MethodEntry.exec 提供，此处只描述展示信息，
 * 便于客户端组件与 SEO 页面在不引入服务端依赖的情况下引用。
 */
export interface ChartMethod {
  /** 方法标识 */
  id: string;
  /** 中文名 */
  name: string;
  /** 简述 */
  description: string;
  /** 是否为命盘类（需要出生时间），占卜类为 false */
  requiresBirth: boolean;
}

/** 统一错误码，供 Route Handler 映射 HTTP 状态 */
export type ChartErrorCode =
  | 'VALIDATION'
  | 'BOUNDARY'
  | 'UNSUPPORTED'
  | 'DEPENDENCY'
  | 'INTERNAL';

export class ChartError extends Error {
  constructor(
    public readonly code: ChartErrorCode,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ChartError';
  }
}
