import { createHash } from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/utils/prisma';

const TEST_KEY = `ci-ingest-key-${Date.now()}`;
const HEADERS = { 'X-API-Key': TEST_KEY };
let sourceId: string;

function sampleEvent(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: new Date().toISOString(),
    eventType: 'ssh_failed_login',
    severity: 'HIGH',
    sourceIp: '203.0.113.99',
    destIp: '10.0.0.5',
    username: 'root',
    metadata: {},
    ...overrides,
  };
}

afterAll(async () => {
  if (sourceId) {
    await prisma.event.deleteMany({ where: { sourceId } });
    await prisma.eventSource.deleteMany({ where: { id: sourceId } });
  }
  await prisma.$disconnect();
});

describe('event ingestion', () => {
  it('creates an active source for the test key', async () => {
    const source = await prisma.eventSource.create({
      data: {
        name: 'CI Test Source',
        apiKeyHash: createHash('sha256').update(TEST_KEY).digest('hex'),
        type: 'AGENT',
        isActive: true,
      },
    });
    sourceId = source.id;
    expect(sourceId).toBeTruthy();
  });

  it('rejects requests without an API key', async () => {
    const res = await request(app).post('/api/v1/events').send(sampleEvent());
    expect(res.status).toBe(400);
  });

  it('rejects unknown API keys', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .set('X-API-Key', 'does-not-exist')
      .send(sampleEvent());
    expect(res.status).toBe(400);
  });

  it('rejects invalid event payloads', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .set(HEADERS)
      .send([{ ...sampleEvent(), timestamp: 'not-a-date' }]);
    expect(res.status).toBe(400);
  });

  it('ingests a batch and skips duplicates', async () => {
    const event = sampleEvent();
    const first = await request(app).post('/api/v1/events').set(HEADERS).send([event]);
    expect(first.status).toBe(201);
    expect(first.body.ingested).toBe(1);

    const second = await request(app).post('/api/v1/events').set(HEADERS).send([event]);
    expect(second.status).toBe(201);
    expect(second.body.ingested).toBe(0);
    expect(second.body.duplicates).toBe(1);
  });

  it('accepts explicit nulls for optional fields', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .set(HEADERS)
      .send([{ ...sampleEvent(), username: null, destIp: null }]);
    expect(res.status).toBe(201);
    expect(res.body.ingested).toBe(1);
  });
});
