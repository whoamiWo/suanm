import { runChart, listMethods } from '@/lib/chart/registry';
import { parseBirthInput } from '@/lib/chart/validate';
import { ChartError } from '@/lib/chart/types';
import { fail, fromChartError, fromUnknownError, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth';

/**
 * 排盘 API。
 *
 * POST /api/chart
 * body: { method: string, input: BirthInput, options?: object }
 * 需要认证，每用户每分钟限 60 次调用。
 *
 * GET  /api/chart  → 可用方法列表（公开，无需认证）
 */
const CHART_RATE_LIMIT = 60; // 每分钟最大请求数

/**
 * 简单的内存速率限制（生产环境建议使用 Redis）。
 * key: `ip:${ip}` 或 `user:${userId}`
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: CHART_RATE_LIMIT - 1 };
  }

  if (entry.count >= CHART_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: CHART_RATE_LIMIT - entry.count };
}

export async function GET() {
  return ok({ methods: listMethods() });
}

export async function POST(request: Request) {
  // 1. 认证检查
  const user = await requireAuth(request.headers);
  if (!user) {
    return fail('UNAUTHORIZED', '未登录或会话已过期', undefined, 401);
  }

  // 2. 速率限制（基于用户 ID）
  const rateLimitResult = checkRateLimit(`user:${user.id}`);
  if (!rateLimitResult.allowed) {
    return fail('RATE_LIMITED', '请求过于频繁，请稍后再试', undefined, 429);
  }

  // 3. 参数解析与排盘
  try {
    const body = (await request.json()) as {
      method?: string;
      input?: unknown;
      options?: Record<string, unknown>;
    };

    if (!body.method) {
      return fail('VALIDATION', '缺少 method 参数');
    }
    if (body.input === undefined) {
      return fail('VALIDATION', '缺少 input 参数');
    }

    const input = parseBirthInput(body.input);
    const result = await runChart(body.method, input, body.options);

    return ok(result, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });
  } catch (err) {
    if (err instanceof ChartError) return fromChartError(err);
    return fromUnknownError(err);
  }
}
