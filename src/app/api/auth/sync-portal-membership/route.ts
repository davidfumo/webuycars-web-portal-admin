import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { syncPortalMembershipForUser } from "@/lib/auth/sync-portal-membership-server";

/**
 * Optional client trigger for the same self-heal that `getPortalContext()` runs
 * server-side. Useful when a route handler / UI needs to force-apply pending
 * dealer membership outside of a server-rendered page (e.g. after a manual
 * "Resend access" follow-up). Returns `{ synced: boolean }` for the caller.
 *
 * Session-only: the route reads the *caller's* `app_metadata`; service role is
 * used internally and never trusts a request body.
 */
export async function POST() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const result = await syncPortalMembershipForUser(user);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (!result.synced) {
      return NextResponse.json({ synced: false, reason: result.reason });
    }
    return NextResponse.json({
      synced: true,
      dealerId: result.dealerId,
      staffRole: result.staffRole,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
