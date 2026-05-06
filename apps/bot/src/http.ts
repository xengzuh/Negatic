import express, { type Express, type Request, type Response } from 'express';
import { verifySignature } from './crypto.js';
import { handleIncoming, type HandlerDeps } from './handler.js';

export interface ServerDeps {
  /** Meta App Secret — HMAC key for inbound webhook signatures. */
  appSecret: string;
  /** Random string Meta echoes back in the GET handshake. */
  verifyToken: string;
  /**
   * Full handler bundle (whatsapp + restaurants + sessions + products +
   * orders). Optional so server unit tests can omit it; when absent,
   * signed POSTs are still acked with 200 but no reply is sent.
   */
  handler?: HandlerDeps;
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
  // We must finish handling before sending 200, otherwise serverless
  // platforms (Vercel) tear the function down mid-flight. Meta's timeout
  // is ~30s, well above what our DB lookup + Graph API call needs.
  // ---------------------------------------------------------------------
  app.post('/webhook', async (req: Request, res: Response) => {
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

    if (deps.handler) {
      try {
        await handleIncoming(req.body, deps.handler);
      } catch (err) {
        console.error('[webhook] handler failed:', err);
        // Still ack 200 so Meta doesn't retry the same broken event.
      }
    } else {
      console.log('[webhook] payload (no handler wired):', JSON.stringify(req.body));
    }

    res.sendStatus(200);
  });

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

type RequestWithRaw = Request & { rawBody?: Buffer };
