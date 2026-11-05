/**
 * 代金卷（credits）工具。
 *
 * 计价口径（对齐星问，用户认知成本最低）：
 * - ¥1 = 23 代金卷
 * - 1 次 AI 解读 ≈ 25 代金卷 ≈ ¥1.09
 *
 * 内部统一用 micros 存整数：1 代金卷 = 1_000_000 micros，
 * 1 元 = 23 代金卷 = 23_000_000 micros。
 */

/** 1 代金卷 = 1,000,000 micros */
export const MICROS_PER_CREDIT = 1_000_000;

/** 1 元兑换多少代金卷（可由环境变量覆盖） */
export function creditsPerYuan(): number {
  const raw = Number(process.env.CREDITS_PER_YUAN ?? 23);
  return Number.isFinite(raw) && raw > 0 ? raw : 23;
}

/** 元 → micros */
export function yuanToMicros(yuan: number): number {
  return Math.round(yuan * creditsPerYuan() * MICROS_PER_CREDIT);
}

/** micros → 元（保留两位） */
export function microsToYuan(micros: number): number {
  return Math.round((micros / (creditsPerYuan() * MICROS_PER_CREDIT)) * 100) / 100;
}

/** micros → 代金卷数（向下取整） */
export function microsToCredits(micros: number): number {
  return Math.floor(micros / MICROS_PER_CREDIT);
}

/** 代金卷 → micros */
export function creditsToMicros(credits: number): number {
  return Math.round(credits * MICROS_PER_CREDIT);
}

/**
 * 报告档位与对应代金卷消耗。
 *
 * 消耗对应实际 token 成本 + 平台毛利，详见 docs/计费模型.md。
 */
export const REPORT_TIERS = {
  /** 免费档：规则摘要，无 LLM 成本 */
  summary: { credits: 0, label: '速览' },
  /** 标准：fast 模型 + 中等思考 */
  standard: { credits: 25, label: '标准' },
  /** 详批：fast 模型 + 高思考 */
  detailed: { credits: 80, label: '详批' },
  /** 深度专项：v3 模型 + 极高思考 */
  deep: { credits: 200, label: '深度专项' },
} as const;

export type ReportTier = keyof typeof REPORT_TIERS;

export function tierCredits(tier: ReportTier): number {
  return REPORT_TIERS[tier].credits;
}
