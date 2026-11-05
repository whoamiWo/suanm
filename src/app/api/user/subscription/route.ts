import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ok, fail } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { userSubscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 用户订阅状态查询 API
 * GET /api/user/subscription
 *
 * 返回用户当前活跃的订阅列表。
 */
export async function GET(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const db = getDb();
    const subs = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, user.id));

    return ok({ subscriptions: subs });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询订阅失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}
