import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

import crypto from 'crypto';

const EMAIL = `analytics-ci-${crypto.randomUUID()}@example.com`;
const PASSWORD = 'TestPassword123!';
let agent: ReturnType<typeof request.agent>;

async function loginAsAnalyst() {
  await request(app).post('/api/v1/auth/register').send({ email: EMAIL, password: PASSWORD, firstName: 'Analytics', lastName: 'CI' });
  await prisma.user.update({ where: { email: EMAIL }, data: { role: 'ANALYST' } });
  agent = request.agent(app);
  const loginRes = await agent.post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(loginRes.status).toBe(200);
}

beforeAll(async () => {
  await loginAsAnalyst();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('analytics flow', () => {
  it('GET /analytics/dashboard returns dashboard stats', async () => {
    const res = await agent.get('/api/v1/analytics/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalEvents: expect.any(Number),
      totalAlerts: expect.any(Number),
      openAlerts: expect.any(Number),
      totalIncidents: expect.any(Number),
      openIncidents: expect.any(Number),
      criticalAlerts: expect.any(Number),
      eventsLast24h: expect.any(Number),
      alertsLast24h: expect.any(Number),
      trends: expect.objectContaining({
        totalEvents: expect.any(String),
        totalAlerts: expect.any(String),
        openAlerts: expect.any(String),
        totalIncidents: expect.any(String),
        openIncidents: expect.any(String),
        criticalAlerts: expect.any(String),
      }),
      topSourceIps: expect.any(Array),
      topEventTypes: expect.any(Array),
      severityDistribution: expect.any(Array),
      eventsTimeSeries: expect.any(Array),
      alertsTimeSeries: expect.any(Array),
    });
  });

  it('GET /analytics/timeseries returns time series data', async () => {
    const res = await agent.get('/api/v1/analytics/timeseries?metric=events&interval=1h');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      metric: 'events',
      interval: '1h',
      data: expect.any(Array),
    });
  });

  it('GET /analytics/timeseries with alerts metric', async () => {
    const res = await agent.get('/api/v1/analytics/timeseries?metric=alerts&interval=1h');
    expect(res.status).toBe(200);
    expect(res.body.metric).toBe('alerts');
  });

  it('rejects invalid interval', async () => {
    const res = await agent.get('/api/v1/analytics/timeseries?interval=invalid');
    expect(res.status).toBe(400);
  });

  it('rejects invalid metric', async () => {
    const res = await agent.get('/api/v1/analytics/timeseries?metric=invalid');
    expect(res.status).toBe(400);
  });
});
