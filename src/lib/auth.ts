import { betterAuth } from 'better-auth';
import * as schema from '@/lib/db/schema';
import { getPool } from '@/lib/db/client';

/**
 * BetterAuth 认证实例。
 *
 * 数据库使用 PostgreSQL + Drizzle ORM，与项目现有 schema 保持一致。
 * 支持 email + password 与 Google OAuth 两种方式。
 */

const pool = getPool();

export const auth = betterAuth({
  database: pool,
  schema,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  session: {
    cookieMaxAge: 60 * 60 * 24 * 30, // 30 天
    updateAge: 60 * 60 * 24, // 1 天更新一次
  },
});

/**
 * 从请求 headers 中获取当前用户会话。
 * 返回 { user, session } 或 null。
 * 注意：better-auth 的 session 对象结构为 { session: {...}, user: {...} }
 */
export async function getSession(headers: Headers) {
  const authHeader = headers.get('authorization') ?? '';
  const cookieHeader = headers.get('cookie') ?? '';

  // better-auth 的 getSession 接受 authorization + cookie 头
  const session = await auth.api.getSession!({
    headers: {
      authorization: authHeader,
      cookie: cookieHeader,
    },
  });

  // 返回 user 对象或 null
  if (!session?.user) {
    return null;
  }
  return { user: session.user, session };
}

/**
 * 强制要求认证的辅助函数。
 * 用于 API Route Handler 中，返回认证用户信息或 null。
 */
export async function requireAuth(headers: Headers) {
  const result = await getSession(headers);
  if (!result?.user) {
    return null;
  }
  return result.user;
}