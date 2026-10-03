/**
 * Apple returns a sign-in by posting a form to the redirect address (response_mode=form_post, the only way it
 * gives the e-mail address). The page that finishes signing in reads its answer from the URL, so this passes the
 * code and the state on with a redirect; the code is single-use and worthless without this tab's PKCE verifier.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const qs = new URLSearchParams();
  for (const k of ["code", "state", "error"]) {
    const v = form.get(k);
    if (typeof v === "string" && v) qs.set(k, v.slice(0, 2000));
  }
  return new Response(null, { status: 303, headers: { Location: `/auth/oidc/apple?${qs}`, "Cache-Control": "no-store" } });
}
