import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

const EMAIL = `incidents-ci-${Date.now()}@example.com`;
const PASSWORD = 'TestPassword123!';
let agent: ReturnType<typeof request.agent>;
let alertId: string;
let incidentId: string;

async function loginAsAnalyst() {
  await request(app).post('/api/v1/auth/register').send({ email: EMAIL, password: PASSWORD, firstName: 'Incidents', lastName: 'CI' });
  await prisma.user.update({ where: { email: EMAIL }, data: { role: 'ANALYST' } });
  agent = request.agent(app);
  const loginRes = await agent.post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(loginRes.status).toBe(200);
}

beforeAll(async () => {
  await loginAsAnalyst();
});

afterAll(async () => {
  if (incidentId) {
    await prisma.incidentAlert.deleteMany({ where: { incidentId } });
    await prisma.incident.delete({ where: { id: incidentId } });
  }
  if (alertId) await prisma.alert.delete({ where: { id: alertId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('incidents flow', () => {
  it('lists incidents with pagination', async () => {
    const res = await agent.get('/api/v1/incidents?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
  });

  it('filters incidents by status', async () => {
    const res = await agent.get('/api/v1/incidents?status=OPEN');
    expect(res.status).toBe(200);
    res.body.data.forEach((i: any) => expect(i.status).toBe('OPEN'));
  });

  it('creates an alert and incident via Prisma', async () => {
    const rule = await prisma.detectionRule.create({
      data: { name: 'CI Incident Rule', logic: { field: 'eventType', operator: 'equals', value: 'test' }, severity: 'CRITICAL' },
    });
    const alert = await prisma.alert.create({
      data: { ruleId: rule.id, severity: 'CRITICAL', status: 'OPEN', title: 'CI Alert', description: 'Test' },
    });
    alertId = alert.id;

    const incident = await prisma.incident.create({
      data: {
        title: 'CI Incident',
        severity: 'CRITICAL',
        status: 'OPEN',
        alerts: { create: [{ alertId }] },
      },
      include: { alerts: true },
    });
    incidentId = incident.id;
    expect(incidentId).toBeTruthy();
  });

  it('gets a single incident by id', async () => {
    const res = await agent.get(`/api/v1/incidents/${incidentId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(incidentId);
    expect(res.body.alerts).toBeInstanceOf(Array);
    expect(res.body.alerts.length).toBe(1);
  });

  it('updates incident status and severity', async () => {
    const res = await agent.patch(`/api/v1/incidents/${incidentId}`).send({ status: 'INVESTIGATING', severity: 'HIGH', riskScore: 75 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INVESTIGATING');
    expect(res.body.severity).toBe('HIGH');
    expect(res.body.riskScore).toBe(75);
  });

  it('adds a note to the incident', async () => {
    const res = await agent.post(`/api/v1/incidents/${incidentId}/notes`).send({ content: 'CI test note' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('CI test note');
  });

  it('returns 404 for missing incident', async () => {
    const res = await agent.get('/api/v1/incidents/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
