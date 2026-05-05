import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify the `X-Hub-Signature-256` header Meta sends on every webhook POST.
 *
 * Meta computes `sha256=<hex>` over the **raw** request body using the
 * App Secret as the HMAC key. We must use the body bytes exactly as they
 * arrived on the wire — any whitespace normalisation or re-serialisation
 * will break the signature. That's why callers pass `Buffer`, not the
 * parsed JSON.
 *
 * Comparison is constant-time to avoid leaking how many leading bytes of
 * the signature the attacker got right.
 */
export function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const provided = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // Both should be 64 hex chars for sha256. If lengths differ,
  // timingSafeEqual would throw — bail safely first.
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(provided, 'utf8'),
    Buffer.from(expected, 'utf8'),
  );
}
