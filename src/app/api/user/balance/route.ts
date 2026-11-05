import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { getBalance } from '@/lib/billing/consume';
import { ok, fail } from '@/lib/api/response';

/**
 * 用户余额查询 API
 * GET /api/user/balance
 *
 * 返回用户钱包余额、订阅额度、总计及订阅详情。
 */
export async function GET(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const balance = await withTransaction(async (tx) => {
      // getBalance 内部已经使用 withTransaction，这里外层再包一层可能导致嵌套事务问题
      // 直接调用 getBalance 即可
      return getBalance(user.id);
    });

    return ok(balance);
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询余额失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}
