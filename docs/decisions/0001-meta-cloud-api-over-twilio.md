# ADR 0001 — Meta Cloud API over Twilio for WhatsApp

- **Date:** 2026-05-03
- **Status:** Accepted
- **Reverses:** initial CLAUDE.md preference for Twilio (same date)

## Context

The MVP needs a WhatsApp wedge: restaurants order chicken via WhatsApp, the
bot calls our API. Two integration paths:

1. **Twilio WhatsApp API** — third-party BSP. Faster onboarding (sandbox in
   minutes), abstracts Meta's surface, but per-message markup on top of Meta
   pricing and requires a future migration to Meta if we outgrow them.
2. **Meta Cloud API (WhatsApp Business Platform)** — direct. Heavier setup
   (Meta Business account, WABA, app secret, webhook verify token, phone
   number provisioning), but no markup and no migration later.

## Decision

Use Meta Cloud API directly. Skip Twilio entirely.

## Consequences

**Good**
- No middleware vendor in the path. Pricing is Meta's published per-conversation rate.
- No future migration. The integration we build now is the one we keep.
- Direct access to features Twilio sometimes lags on (interactive messages, flows).

**Bad / costly**
- ~1–2 days of upfront setup before the bot can send a single message:
  Meta Business verification, App + WABA creation, phone number provisioning,
  webhook verification handshake, App Secret HMAC validation.
- Sender phone number cannot be reused for personal WhatsApp.
- We're on the hook for our own sandbox/test number plumbing.

**Mitigations**
- Capture the setup steps in `apps/bot/README.md` so the work is documented.
- Build the bot's webhook handler and outbound client as the first slice once
  Meta credentials are ready. Until then the bot scaffold is a no-op.

## Alternatives considered

- **Stay on Twilio for MVP, migrate later.** Rejected: a migration
  mid-launch is a known time sink, and the cost savings start mattering
  almost immediately if the wedge works.
- **WhatsApp via 360dialog or other BSP.** Rejected for the same reason as
  Twilio plus less name recognition.
