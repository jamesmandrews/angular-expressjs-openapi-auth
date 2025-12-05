import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

let pool: Pool | null = null;

function getConnectionConfig() {
  // Support DATABASE_URL or individual settings
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'authuser',
    password: process.env.POSTGRES_PASSWORD || 'authpass',
    database: process.env.POSTGRES_DB || 'authdb',
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getConnectionConfig());

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New client connected to PostgreSQL pool');
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT NOW()');
    logger.info('PostgreSQL connection successful');
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection failed', { error: (error as Error).message });
    return false;
  }
}
