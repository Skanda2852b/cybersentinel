import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('system health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /ready reports database connectivity', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/no-such-route-xyz');
    expect(res.status).toBe(404);
  });
});
