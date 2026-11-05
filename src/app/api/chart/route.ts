import { runChart, listMethods } from '@/lib/chart/registry';
import { METHOD_MAP } from '@/lib/chart/methods-meta';
import type { BirthInput } from '@/lib/chart/types';
import { parseBirthInput, parseDivinationInput } from '@/lib/chart/validate';
import { ChartError } from '@/lib/chart/types';
import { fail, fromChartError, fromUnknownError, ok } from '@/lib/api/response';
import { checkRateLimit, clientIp } from '@/lib/api/rate-limit';
import { getSession } from '@/lib/auth';

/**
 * 排盘 API。
 *
 * POST /api/chart
 * body: { method: string, input: BirthInput, options?: object }
 *
 * 设计约定（与整体产品策略一致）：
 * - **免登录**：基础排盘对匿名用户开放，这是免费引流与 SEO 收录的前提。
 *   登录与否只影响是否关联到个人档案与配额，不影响排盘可用性。
 * - 限流按 IP（匿名）或用户（登录）维度，Redis 共享计数。
 *
 * GET  /api/chart  → 可用方法列表（公开）
 */
/** 占卜类方法的占位出生信息（不参与计算） */
const EMPTY_BIRTH_INPUT: BirthInput = {
  birthYear: 2000,
  birthMonth: 1,
  birthDay: 1,
  gender: 'male',
};

const ANONYMOUS_LIMIT = 30; // 每分钟
const AUTHED_LIMIT = 120; // 每分钟

export async function GET() {
  return ok({ methods: listMethods() });
}

export async function POST(request: Request) {
  try {
    // 可选认证：有会话则用用户维度限流并关联档案，匿名用户仍可排盘
    const session = await getSession(request.headers).catch(() => null);
    const userId = session?.user?.id;
    const limit = userId ? AUTHED_LIMIT : ANONYMOUS_LIMIT;
    const limitKey = userId ? `user:${userId}` : `ip:${clientIp(request)}`;

    const rateLimitResult = await checkRateLimit(limitKey, limit);
    if (!rateLimitResult.allowed) {
      return fail(
        'RATE_LIMITED',
        '请求过于频繁，请稍后再试',
        { limit: rateLimitResult.limit },
        429,
      );
    }

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

    // 命理类需出生信息，占卜类需问事时间，按方法类型分流校验
    const methodMeta = METHOD_MAP[body.method];
    const requiresBirth = methodMeta?.requiresBirth ?? true;

    const result = requiresBirth
      ? await runChart(body.method, parseBirthInput(body.input), body.options)
      : await runChart(body.method, EMPTY_BIRTH_INPUT, {
          ...parseDivinationInput(body.input),
          ...(body.options ?? {}),
        });

    return ok(result, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });
  } catch (err) {
    if (err instanceof ChartError) return fromChartError(err);
    return fromUnknownError(err);
  }
}
