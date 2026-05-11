"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getPortalContext } from "@/lib/auth/portal";
import { getClientEnv } from "@/env";

export type LoginActionState =
  | null
  | { ok: false; error: "invalid" | "not_provisioned" | "missing" | "no_portal" };

/**
 * Server-side sign-in so session cookies are written via Next.js `cookies()`
 * (same pattern as middleware). Client-only signIn often leaves the server
 * without a session on the next navigation.
 */
export async function signInWithPasswordAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "pt");

  if (!email || !password) {
    return { ok: false, error: "missing" };
  }

  const cookieStore = await cookies();
  const env = getClientEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: "invalid" };
  }

  const ctx = await getPortalContext();
  if (!ctx) {
    await supabase.auth.signOut();
    return { ok: false, error: "not_provisioned" };
  }
  if (ctx.surface === "none") {
    await supabase.auth.signOut();
    return { ok: false, error: "no_portal" };
  }

  redirect(`/${locale}`);
}
