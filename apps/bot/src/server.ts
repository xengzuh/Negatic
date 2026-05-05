import express, { type Express, type Request, type Response } from 'express';
import { verifySignature } from './crypto.js';
import { handleIncoming } from './handler.js';
import type { WhatsAppClient } from './whatsapp.js';

export interface ServerDeps {
  /** Meta App Secret — HMAC key for inbound webhook signatures. */
  appSecret: string;
  /** Random string Meta echoes back in the GET handshake. */
  verifyToken: string;
  /**
   * Outbound WhatsApp client. Optional so unit tests can omit it; when
   * absent, signed POSTs are still acked with 200 but no reply is sent.
   */
  whatsapp?: WhatsAppClient;
}

/**
 * Build the Express app. Pure factory — caller injects all deps so tests
 * can pass fixtures without env or network.
 */
export function createServer(deps: ServerDeps): Express {
  const app = express();

  // Capture the raw request body BEFORE express.json() parses it. We need
  // the exact bytes on the wire to verify Meta's HMAC.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRaw).rawBody = buf;
      },
    }),
  );

  // ---------------------------------------------------------------------
  // GET /webhook — Meta verification handshake.
  // Meta calls this once when we register/update the webhook subscription.
  // ---------------------------------------------------------------------
  app.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token === deps.verifyToken &&
      typeof challenge === 'string'
    ) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }

    res.sendStatus(403);
  });

  // ---------------------------------------------------------------------
  // POST /webhook — incoming WhatsApp events.
  // Validate HMAC, then ack with 200. Meta retries on non-2xx, so we want
  // to ack quickly and process async. (Async dispatch comes in a follow-up.)
  // ---------------------------------------------------------------------
  app.post('/webhook', (req: Request, res: Response) => {
    const sig = req.header('x-hub-signature-256');
    const raw = (req as RequestWithRaw).rawBody;

    if (!raw) {
      // Should not happen with our middleware, but fail closed if it does.
      res.sendStatus(400);
      return;
    }

    if (!verifySignature(raw, sig, deps.appSecret)) {
      res.sendStatus(403);
      return;
    }

    // Ack Meta first — they retry on non-2xx within ~30s and we don't want
    // a slow reply to trigger duplicate deliveries. Then dispatch async.
    res.sendStatus(200);

    if (deps.whatsapp) {
      const whatsapp = deps.whatsapp;
      void Promise.resolve()
        .then(() => handleIncoming(req.body, whatsapp))
        .catch((err: unknown) => {
          console.error('[webhook] handler failed:', err);
        });
    } else {
      console.log('[webhook] payload (no outbound client):', JSON.stringify(req.body));
    }
  });

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

type RequestWithRaw = Request & { rawBody?: Buffer };
