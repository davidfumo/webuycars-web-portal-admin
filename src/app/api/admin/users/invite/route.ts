import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { inviteUserWithEmailFallback } from "@/lib/auth/invite-helpers";

const bodySchema = z.object({
  email: z.string().email(),
  portalLocale: z.enum(["pt", "en"]).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!appUser || appUser.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let service;
    try {
      service = createServiceSupabaseClient();
    } catch {
      return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const loc = parsed.data.portalLocale ?? "pt";
    const redirectTo = `${origin}/${loc}/login`;

    const invited = await inviteUserWithEmailFallback(
      service,
      parsed.data.email,
      redirectTo,
      { role: "admin" },
    );

    if (!invited.ok) {
      if (invited.error === "email_exists") {
        return NextResponse.json({ error: "email_exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "invite_failed" }, { status: 400 });
    }

    return NextResponse.json({
      userId: invited.userId,
      inviteEmailSent: invited.emailSent,
      setupLink: invited.setupLink,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
