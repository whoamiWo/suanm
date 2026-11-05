import { requireAuth } from '@/lib/auth';
import { redeemCode, RedeemError } from '@/lib/billing/redeem';
import { ok, fail } from '@/lib/api/response';

/**
 * 兑换码核销 API
 * POST /api/redeem
 *
 * body: { code: string }
 *
 * 返回核销结果：余额充值或订阅激活。
 */
export async function POST(request: Request) {
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  try {
    const { code } = await request.json();
    if (!code || code.trim() === '') {
      return fail('VALIDATION', '兑换码不能为空');
    }

    const result = await redeemCode(code.trim(), user.id);

    return ok(result);
  } catch (err) {
    if (err instanceof RedeemError) {
      return fail(err.code as 'NOT_FOUND', err.message, undefined, 400);
    }
    const message = err instanceof Error ? err.message : '核销失败';
    return fail('INTERNAL', message, undefined, 500);
  }
}