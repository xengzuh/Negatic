# @negatic/shared-schemas

Zod schemas mirroring the OpenAPI contract. Use these at every API boundary:
incoming HTTP requests, WhatsApp webhook payloads, outbound webhook bodies.

These are the *runtime* contract. `api-spec/openapi.yaml` is the *static*
contract. They must stay in sync — when one changes, change the other in the
same PR.
