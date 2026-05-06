import { NextResponse } from 'next/server';

// Serves an interactive API reference at /docs using the Scalar CDN embed.
// The spec is loaded from /openapi.yaml (served from public/).
export function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Negatic API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.yaml"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
