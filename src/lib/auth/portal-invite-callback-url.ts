/**
 * Where Supabase should redirect after invite / recovery / magic links for this web console.
 * Must be listed under Authentication → URL configuration → Redirect URLs in Supabase.
 */
export function portalInviteCallbackUrl(origin: string, locale: string): string {
  const loc = locale === "en" ? "en" : "pt";
  const base = origin.replace(/\/$/, "");
  return `${base}/${loc}/auth/complete-invite`;
}
