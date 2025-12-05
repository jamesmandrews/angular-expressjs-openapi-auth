import request from 'supertest';
import { createTestApp } from '../helpers/testHelpers';

describe('Health Check Endpoint', () => {
  const app = createTestApp();

  it('should return health status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('memory');
  });

  it('should return memory usage in MB', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.body.memory).toHaveProperty('used');
    expect(response.body.memory).toHaveProperty('total');
    expect(response.body.memory).toHaveProperty('unit', 'MB');
    expect(typeof response.body.memory.used).toBe('number');
    expect(typeof response.body.memory.total).toBe('number');
  });

  it('should return uptime as a number', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThan(0);
  });
});
