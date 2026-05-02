// Negatic WhatsApp bot — Meta Cloud API receiver.
//
// Not implemented yet. Planned shape:
//   - GET  /webhook  — verification handshake (echo hub.challenge)
//   - POST /webhook  — incoming messages (verify X-Hub-Signature-256, dispatch)
//   - Outbound messages -> POST graph.facebook.com/v19.0/{phone_number_id}/messages
//
// MVP flow: button-driven order entry for chicken, next-day delivery.
// No LLM/NLU per CLAUDE.md MVP scope.

export {};
