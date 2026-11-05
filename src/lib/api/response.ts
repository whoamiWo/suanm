import { NextResponse } from 'next/server';
import { ChartError, type ChartErrorCode } from '@/lib/chart/types';

/**
 * 统一 API 响应封装。
 *
 * 成功：{ ok: true, data }
 * 失败：{ ok: false, error: { code, message, detail } }
 */

export interface ApiError {
  code: ChartErrorCode | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAUTHORIZED';
  message: string;
  detail?: unknown;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(code: ApiError['code'], message: string, detail?: unknown, status = 400) {
  return NextResponse.json({ ok: false as const, error: { code, message, detail } }, { status });
}

/** 将 ChartError 映射为 HTTP 响应 */
export function fromChartError(err: ChartError) {
  const statusMap: Record<ChartErrorCode, number> = {
    VALIDATION: 400,
    BOUNDARY: 400,
    UNSUPPORTED: 400,
    DEPENDENCY: 501,
    INTERNAL: 500,
  };
  return fail(err.code, err.message, err.detail, statusMap[err.code] ?? 500);
}

/** 捕获未知异常 */
export function fromUnknownError(err: unknown) {
  const message = err instanceof Error ? err.message : '未知错误';
  return fail('INTERNAL', message, undefined, 500);
}
