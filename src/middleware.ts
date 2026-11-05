import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware。
 *
 * 对 /api/chart, /api/reports, /api/user 进行身份验证。
 * 未登录请求返回 401。
 */

export const config = {
  matcher: ['/api/chart', '/api/reports', '/api/user'],
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 获取会话
  const session = await getSession(request.headers);
  if (!session?.user) {
    // 对于 API 路径，返回 JSON 401
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未登录或会话已过期',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    // 对于页面路径，重定向到登录页（未来实现）
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 已登录，允许通过
  return NextResponse.next();
}