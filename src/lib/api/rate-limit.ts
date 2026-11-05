import { Redis } from 'ioredis';

/**
 * 速率限制。
 *
 * 生产环境用 Redis 共享计数（多实例一致）；
 * Redis 不可用时降级为进程内 Map，保证功能可用但不跨实例。
 */

const WINDOW_SECONDS = 60;

let redis: Redis | null = null;
let redisInitFailed = false;

/** 获取 Redis 连接（懒加载，失败后不再重试） */
function getRedis(): Redis | null {
  if (redis) return redis;
  if (redisInitFailed) return null;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisInitFailed = true;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on('error', () => {
      redisInitFailed = true;
    });
    return redis;
  } catch {
    redisInitFailed = true;
    return null;
  }
}

/** 进程内降级计数 */
const fallbackMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * 固定窗口限流。
 *
 * @param key 限流维度，如 ip:1.2.3.4 或 user:xxx
 * @param limit 窗口内最大请求数
 */
export async function checkRateLimit(
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const client = getRedis();

  if (client) {
    try {
      const redisKey = `rl:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, WINDOW_SECONDS);
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        limit,
      };
    } catch {
      // Redis 异常时降级到内存
    }
  }

  const now = Date.now();
  const entry = fallbackMap.get(key);
  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return { allowed: true, remaining: limit - 1, limit };
  }
  entry.count++;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    limit,
  };
}

/** 提取客户端 IP（用于匿名限流） */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
