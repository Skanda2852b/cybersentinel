import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

const email = `ci-test-${Date.now()}@example.com`;
const password = 'TestPassword123!';
let userId: string;

afterAll(async () => {
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

describe('auth flow', () => {
  it('rejects invalid registration payloads', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('registers a new user as VIEWER and logs them in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'CI', lastName: 'Tester' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('VIEWER');
    userId = res.body.user.id;
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('access_token');
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'AnotherPass123!' });
    expect(res.status).toBe(409);
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword123!' });
    expect(res.status).toBe(401);
  });

  it('logs in and returns the current user', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects unauthenticated /auth/me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('updates profile names', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password });
    const res = await agent.patch('/api/v1/auth/me').send({ firstName: 'CI-Updated' });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('CI-Updated');
  });

  it('changes password and enforces it on next login', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password });
    const changed = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: password, newPassword: 'NewPassword456!' });
    expect(changed.status).toBe(200);

    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'NewPassword456!' });
    expect(relogin.status).toBe(200);
  });
});
