/**
 * Integration smoke tests (audit D1) — the first HTTP-level coverage of server.js.
 * Runs WITHOUT DB/Redis/Gemini (graceful-degradation paths) and asserts the
 * contracts the frontend and admin tools rely on: auth gates, input validation,
 * security headers, and that the app boots at all under NODE_ENV=test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_KEY = 'test-admin-key';
process.env.ADMIN_SECRET = 'test-admin-secret';

let app;
beforeAll(async () => {
  ({ app } = await import('../server.js'));
});

describe('boot & security headers', () => {
  it('app boots under NODE_ENV=test without listening', () => {
    expect(app).toBeTruthy();
  });

  it('helmet security headers are present', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
  });

  it('/api/health responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('admin auth gates (header-only, audit A5)', () => {
  it('/api/admin/metrics rejects without key', async () => {
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(403);
  });

  it('/api/admin/metrics rejects a query-string key (must be header)', async () => {
    const res = await request(app).get('/api/admin/metrics?key=test-admin-key&adminKey=test-admin-key');
    expect(res.status).toBe(403);
  });

  it('/api/admin/metrics accepts the x-admin-key header', async () => {
    const res = await request(app).get('/api/admin/metrics').set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(200);
    expect(res.body.process).toBeTruthy();
    expect(res.body.process.confidence).toBeTruthy();
    expect(res.body.flags).toHaveProperty('corpusAnalysisEnabled');
    expect(res.body.budget).toHaveProperty('dailyLimit');
  });

  it('/api/admin/traction rejects without key', async () => {
    const res = await request(app).get('/api/admin/traction');
    expect(res.status).toBe(403);
  });

  it('/api/admin/traction rejects a query-string key (must be header)', async () => {
    const res = await request(app).get('/api/admin/traction?key=test-admin-key&adminKey=test-admin-key');
    expect(res.status).toBe(403);
  });

  it('/api/admin/traction degrades to 503 (not 500) when the DB is unavailable', async () => {
    // Traction is DB-only by design; without Postgres it must say so rather than crash.
    const res = await request(app).get('/api/admin/traction').set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(503);
    expect(res.body.error).toBeTruthy();
  });

  it('/api/experiment/rss-check rejects ?secret= (query) and demands the header', async () => {
    const res = await request(app).get('/api/experiment/rss-check?topic=Klima&secret=test-admin-secret');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/x-admin-secret/);
  });
});

describe('input validation', () => {
  it('/api/feedback rejects missing verdict', async () => {
    const res = await request(app).post('/api/feedback').send({ topic: 'Klima' });
    expect(res.status).toBe(400);
  });

  it('/api/feedback rejects an invalid verdict', async () => {
    const res = await request(app).post('/api/feedback').send({ topic: 'Klima', verdict: 'meh' });
    expect(res.status).toBe(400);
  });

  it('/api/feedback accepts a valid vote (DB-less → ok:false but 200)', async () => {
    const res = await request(app).post('/api/feedback').send({ topic: 'Klima', verdict: 'up', lang: 'de' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok');
  });

  it('/api/analyze/stream rejects an empty topic', async () => {
    const res = await request(app).get('/api/analyze/stream?topic=');
    expect(res.status).toBe(400);
  });

  it('/api/deep-analysis rejects a missing topic', async () => {
    const res = await request(app).post('/api/deep-analysis').send({});
    expect(res.status).toBe(400);
  });
});
