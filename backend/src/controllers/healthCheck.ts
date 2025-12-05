import { Request, Response } from 'express';
import { query } from '../db/connection';

/**
 * Health check endpoint
 * Returns server status and basic metrics including database health
 */
export default async function healthCheck(_req: Request, res: Response): Promise<void> {
  let dbStatus: { status: string; latencyMs?: number; error?: string };

  try {
    const start = Date.now();
    await query('SELECT 1');
    const latencyMs = Date.now() - start;
    dbStatus = { status: 'connected', latencyMs };
  } catch (error) {
    dbStatus = { status: 'disconnected', error: (error as Error).message };
  }

  const isHealthy = dbStatus.status === 'connected';

  const healthData = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  res.status(isHealthy ? 200 : 503).json(healthData);
}
