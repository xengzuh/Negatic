# @negatic/bot

WhatsApp bot for restaurants. Talks to Meta Cloud API (WhatsApp Business
Platform), calls the Negatic API on the user's behalf.

## Scope (MVP)

- One flow: order chicken for next-day delivery.
- Button-based intent matching only — no LLM/NLU.
- One supplier, three restaurants.

## Architecture

The bot is just another API consumer. It does not have privileged access to
the database. When a restaurant says "order 5kg chicken breast tomorrow," the
bot constructs an `OrderCreate` payload, sends `Idempotency-Key` + Bearer
token, and POSTs `/v1/orders` like any other client.

## Meta setup (one-time)

1. Create a Meta Business account.
2. Create a Meta Developer App with the WhatsApp product enabled.
3. Provision a WhatsApp Business Account (WABA) and phone number.
4. Generate a long-lived system user access token with
   `whatsapp_business_messaging` permission.
5. Create a random `META_WEBHOOK_VERIFY_TOKEN` (any opaque string we choose).
6. Subscribe the webhook URL `${BOT_PUBLIC_URL}/webhook` to `messages` events.
   Meta will GET it once with `hub.verify_token` and `hub.challenge` — we
   echo the challenge back to confirm ownership.
7. Copy `App Secret` from the App settings into `META_APP_SECRET`. Inbound
   POSTs are signed `X-Hub-Signature-256: sha256=<hmac>`; we MUST verify it.

## Webhook verification (inbound)

Meta signs every POST with HMAC-SHA256 over the raw body using the App Secret.
Compute `sha256=<hmac>` and constant-time compare with `X-Hub-Signature-256`.
Reject mismatches. Always read the *raw* body before any JSON parsing.

## Outbound

```
POST https://graph.facebook.com/v19.0/{META_WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {META_WHATSAPP_ACCESS_TOKEN}
Content-Type: application/json

{ "messaging_product": "whatsapp", "to": "...", "type": "...", ... }
```

Outside the 24-hour service window, only pre-approved templates can be sent.
