import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * 数据库连接。
 *
 * 约束（借鉴 taibu 架构规范）：
 * - 路由与组件不得自行创建连接池，统一从此处获取单例。
 * - 未配置 DATABASE_URL 时不抛错，由调用方按需判断（便于无库环境跑单元测试）。
 */

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL 未配置');
    }
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // 连接池超时后释放，避免请求悬挂
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/**
 * 事务包装。
 *
 * 使用 drizzle 的 transaction，保证事务内的所有查询走同一连接。
 */
export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx));
}

/** drizzle 事务类型 */
export type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

