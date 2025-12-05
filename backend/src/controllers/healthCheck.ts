import { Request, Response } from 'express';

/**
 * Health check endpoint
 * Returns server status and basic metrics
 */
export default async function healthCheck(_req: Request, res: Response): Promise<void> {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  res.status(200).json(healthData);
}
