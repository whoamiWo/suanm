import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '@/lib/db/schema';
import { getDb } from '@/lib/db/client';

/**
 * BetterAuth 认证实例。
 *
 * 数据库使用 PostgreSQL + Drizzle ORM，与项目现有 schema 保持一致。
 * 支持 email + password 登录；Google OAuth 仅在配置了凭据时启用。
 */

/** Google OAuth 凭据（未配置时不启用该 provider） */
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    // auth 表位于独立的 auth schema，避免与业务表的同名 user_id 产生外键歧义
    schema: {
      ...schema,
      // 显式指向 auth schema 下的四张表
      user: schema.authUser,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  session: {
    cookieMaxAge: 60 * 60 * 24 * 30, // 30 天
    updateAge: 60 * 60 * 24, // 1 天更新一次
  },
  advanced: {
    database: {
      // 使用 uuid 作为主键，与业务表（billing_*.user_id 等）保持同一 ID 空间
      generateId: 'uuid',
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

/**
 * 从请求 headers 中获取当前用户会话。
 *
 * better-auth 需要原始 Headers 实例来读取 cookie，
 * 不能传普通对象字面量。
 */
export async function getSession(headers: Headers) {
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;
    return { user: session.user, session };
  } catch {
    // 会话解析失败按未登录处理，不影响匿名排盘
    return null;
  }
}

/**
 * 强制要求认证的辅助函数。
 * 用于 API Route Handler 中，返回认证用户信息或 null。
 */
export async function requireAuth(headers: Headers) {
  const result = await getSession(headers);
  return result?.user ?? null;
}
