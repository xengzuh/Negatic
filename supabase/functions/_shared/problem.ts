/** RFC 7807 Problem Details response. */
export function problem(
  status: number,
  title: string,
  detail?: string,
): Response {
  const body: Record<string, unknown> = {
    type: 'about:blank',
    title,
    status,
  };
  if (detail) body.detail = detail;

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
