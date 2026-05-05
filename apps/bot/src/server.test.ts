import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from './server.js';

const APP_SECRET = 'test-app-secret-for-vitest';
const VERIFY_TOKEN = 'test-verify-token-for-vitest';

const app = createServer({
  appSecret: APP_SECRET,
  verifyToken: VERIFY_TOKEN,
});

function sign(body: string, secret: string = APP_SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('GET /webhook (Meta verification handshake)', () => {
  it('echoes the challenge when verify_token matches', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'pong',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('pong');
  });

  it('rejects when verify_token is wrong', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'pong',
    });
    expect(res.status).toBe(403);
  });

  it('rejects when mode is not subscribe', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'pong',
    });
    expect(res.status).toBe(403);
  });

  it('rejects when challenge is missing', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /webhook (signed event receive)', () => {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'test', changes: [] }],
  });

  it('accepts a correctly signed payload', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(body))
      .send(body);
    expect(res.status).toBe(200);
  });

  it('rejects when signature header is missing', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(403);
  });

  it('rejects when body has been tampered with', async () => {
    const sig = sign(body);
    const tamperedBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: 'evil', changes: [] }],
    });
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sig)
      .send(tamperedBody);
    expect(res.status).toBe(403);
  });

  it('rejects when signature was made with the wrong secret', async () => {
    const wrongSig = sign(body, 'attacker-guessed-secret');
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', wrongSig)
      .send(body);
    expect(res.status).toBe(403);
  });

  it('rejects when signature has bad prefix', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'md5=abc')
      .send(body);
    expect(res.status).toBe(403);
  });
});

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
