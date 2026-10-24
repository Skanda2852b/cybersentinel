import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

const EMAIL = `alerts-ci-${Date.now()}@example.com`;
const PASSWORD = 'TestPassword123!';
let agent: ReturnType<typeof request.agent>;
let alertId: string;

async function loginAsAnalyst() {
  await request(app).post('/api/v1/auth/register').send({ email: EMAIL, password: PASSWORD, firstName: 'Alerts', lastName: 'CI' });
  await prisma.user.update({ where: { email: EMAIL }, data: { role: 'ANALYST' } });
  agent = request.agent(app);
  const loginRes = await agent.post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(loginRes.status).toBe(200);
}

beforeAll(async () => {
  await loginAsAnalyst();
});

afterAll(async () => {
  if (alertId) {
    await prisma.alert.delete({ where: { id: alertId } });
  }
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('alerts flow', () => {
  it('lists alerts with pagination', async () => {
    const res = await agent.get('/api/v1/alerts?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
  });

  it('filters alerts by status', async () => {
    const res = await agent.get('/api/v1/alerts?status=OPEN');
    expect(res.status).toBe(200);
    res.body.data.forEach((a: any) => expect(a.status).toBe('OPEN'));
  });

  it('filters alerts by severity', async () => {
    const res = await agent.get('/api/v1/alerts?severity=HIGH');
    expect(res.status).toBe(200);
    res.body.data.forEach((a: any) => expect(a.severity).toBe('HIGH'));
  });

  it('creates an alert via Prisma for status update test', async () => {
    const rule = await prisma.detectionRule.create({
      data: { name: 'CI Test Rule', logic: { field: 'eventType', operator: 'equals', value: 'ssh_failed_login' }, severity: 'HIGH' },
    });
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        severity: 'HIGH',
        status: 'OPEN',
        title: 'CI Alert',
        description: 'Test alert',
      },
      include: { rule: true },
    });
    alertId = alert.id;
    expect(alertId).toBeTruthy();
  });

  it('updates alert status to ACKNOWLEDGED', async () => {
    const res = await agent.patch(`/api/v1/alerts/${alertId}/status`).send({ status: 'ACKNOWLEDGED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACKNOWLEDGED');
    expect(res.body.acknowledgedAt).toBeTruthy();
  });

  it('updates alert status to RESOLVED', async () => {
    const res = await agent.patch(`/api/v1/alerts/${alertId}/status`).send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.resolvedAt).toBeTruthy();
  });

  it('gets a single alert by id', async () => {
    const res = await agent.get(`/api/v1/alerts/${alertId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(alertId);
  });

  it('rejects invalid status', async () => {
    const res = await agent.patch(`/api/v1/alerts/${alertId}/status`).send({ status: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing alert', async () => {
    const res = await agent.get('/api/v1/alerts/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
