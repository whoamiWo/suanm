import { requireAuth } from '@/lib/auth';
import { ok, fail } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { reports, chartResults } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';

/**
 * 报告列表查询 API
 * GET /api/reports
 *
 * 返回当前用户的 AI 解读报告列表。
 */
export async function GET(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const db = getDb();
    const userReports = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, user.id))
      .orderBy(desc(reports.createdAt))
      .limit(50);

    return ok({ reports: userReports });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询报告失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}

/** 允许的报告档位 */
const VALID_TIERS = ['summary', 'standard', 'detailed', 'deep'] as const;
type ReportTier = (typeof VALID_TIERS)[number];

/**
 * 报告创建 API
 * POST /api/reports
 *
 * body: { chartId: string, tier: string }
 *
 * 为指定排盘结果创建 AI 解读报告任务。
 */
export async function POST(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const body = (await request.json()) as {
      chartId?: string;
      tier?: string;
      model?: string;
      promptVersion?: string;
    };

    if (!body.chartId) {
      return fail('VALIDATION', '缺少 chartId 参数');
    }
    const tier = (body.tier ?? 'summary') as ReportTier;
    if (!VALID_TIERS.includes(tier)) {
      return fail('VALIDATION', `tier 非法，可选值：${VALID_TIERS.join(', ')}`);
    }

    const db = getDb();
    // 关键：必须同时校验归属，防止读取他人排盘
    const chart = await db
      .select()
      .from(chartResults)
      .where(
        and(
          eq(chartResults.id, body.chartId),
          eq(chartResults.userId, user.id),
        ),
      )
      .limit(1);

    if (!chart.length) {
      return fail('NOT_FOUND', '排盘结果不存在或无权访问', undefined, 404);
    }

    const inserted = await db
      .insert(reports)
      .values({
        userId: user.id,
        chartId: body.chartId,
        tier,
        model: body.model ?? null,
        promptVersion: body.promptVersion ?? null,
        contentMd: '',
        status: 'pending',
      })
      .returning();

    return ok({ report: inserted[0] }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建报告失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}
