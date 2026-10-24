import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

const EMAIL = `iocs-ci-${Date.now()}@example.com`;
const PASSWORD = 'TestPassword123!';
let agent: ReturnType<typeof request.agent>;
let iocId: string;

async function loginAsAnalyst() {
  await request(app).post('/api/v1/auth/register').send({ email: EMAIL, password: PASSWORD, firstName: 'IOCs', lastName: 'CI' });
  await prisma.user.update({ where: { email: EMAIL }, data: { role: 'ADMIN' } });
  agent = request.agent(app);
  const loginRes = await agent.post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(loginRes.status).toBe(200);
}

beforeAll(async () => {
  await loginAsAnalyst();
});

afterAll(async () => {
  if (iocId) await prisma.iOC.delete({ where: { id: iocId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('iocs flow', () => {
  it('lists IOCs with pagination', async () => {
    const res = await agent.get('/api/v1/iocs?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
  });

  it('filters IOCs by type', async () => {
    const res = await agent.get('/api/v1/iocs?type=IP');
    expect(res.status).toBe(200);
    res.body.data.forEach((i: any) => expect(i.type).toBe('IP'));
  });

  it('filters IOCs by isActive', async () => {
    const res = await agent.get('/api/v1/iocs?isActive=true');
    expect(res.status).toBe(200);
    res.body.data.forEach((i: any) => expect(i.isActive).toBe(true));
  });

  it('creates an IOC', async () => {
    const res = await agent.post('/api/v1/iocs').send({
      type: 'IP',
      value: '198.51.100.42',
      confidence: 0.95,
      source: 'CI Test Feed',
      tags: ['malware', 'c2'],
      description: 'CI test IOC',
      isActive: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('IP');
    expect(res.body.value).toBe('198.51.100.42');
    expect(res.body.confidence).toBe(0.95);
    iocId = res.body.id;
  });

  it('gets a single IOC by id', async () => {
    const res = await agent.get(`/api/v1/iocs/${iocId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(iocId);
  });

  it('searches IOCs by value', async () => {
    const res = await agent.get('/api/v1/iocs?search=198.51.100.42');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('deletes an IOC', async () => {
    const res = await agent.delete(`/api/v1/iocs/${iocId}`);
    expect(res.status).toBe(204);
    iocId = undefined;

    const getRes = await agent.get('/api/v1/iocs/00000000-0000-0000-0000-000000000000');
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for missing IOC', async () => {
    const res = await agent.get('/api/v1/iocs/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
