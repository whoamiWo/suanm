import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ok, fail } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { reports, chartResults } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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

/**
 * 报告创建 API
 * POST /api/reports
 *
 * body: { chartId: string, tier: string, model?: string, promptVersion?: string }
 *
 * 为指定排盘结果生成 AI 解读报告。
 */
export async function POST(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const { chartId, tier = 'summary', model, promptVersion } = await request.json();

    if (!chartId) {
      return fail('VALIDATION', '缺少 chartId 参数');
    }

    const db = getDb();
    const chart = await db
      .select()
      .from(chartResults)
      .where(eq(chartResults.id, chartId))
      .limit(1);

    if (!chart.length) {
      return fail('NOT_FOUND', '排盘结果不存在', undefined, 404);
    }

    const reportData = {
      userId: user.id,
      chartId,
      tier,
      model: model ?? null,
      promptVersion: promptVersion ?? null,
      contentMd: '',
      inputTokens: null,
      outputTokens: null,
      costMicros: null,
      status: 'pending' as const,
    };

    const inserted = await db.insert(reports).values(reportData).returning();
    const newReport = inserted[0];

    return ok({ report: newReport }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建报告失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}