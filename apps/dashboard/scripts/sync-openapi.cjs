// Copies the canonical OpenAPI spec from api-spec/ into public/ so Next.js
// serves it as a static asset at /openapi.yaml.
const { copyFileSync } = require('fs');
const { join } = require('path');

copyFileSync(
  join(__dirname, '../../../api-spec/openapi.yaml'),
  join(__dirname, '../public/openapi.yaml'),
);
