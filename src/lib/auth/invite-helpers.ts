import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { stampPortalPendingDealerInvite } from "@/lib/auth/portal-pending-invite";

export function isEmailAlreadyRegisteredError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  const c = err.code ?? "";
  return (
    c === "email_exists" ||
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("duplicate")
  );
}

type ServiceClient = SupabaseClient<Database>;

export type InviteUserResult =
  | { ok: true; userId: string; emailSent: boolean; setupLink: string | null }
  | { ok: false; error: "email_exists" | "invite_failed" };

/**
 * Prefer Supabase invite email; if that fails for a non–email-exists reason,
 * fall back to admin generateLink (manual link for the inviter).
 */
export async function inviteUserWithEmailFallback(
  service: ServiceClient,
  email: string,
  redirectTo: string,
  userMetadata: Record<string, string>,
  portalPending?: { dealerId: string; staffRole: "manager" | "staff" },
): Promise<InviteUserResult> {
  const invited = await service.auth.admin.inviteUserByEmail(email, {
    data: userMetadata,
    redirectTo,
  });

  if (!invited.error && invited.data.user) {
    const userId = invited.data.user.id;
    await service.auth.admin.updateUserById(userId, { user_metadata: userMetadata });
    if (portalPending) {
      await stampPortalPendingDealerInvite(
        service,
        userId,
        portalPending.dealerId,
        portalPending.staffRole,
      );
    }
    /** Same link the email would contain — lets admins share access if the inbox never receives mail. */
    const backup = await service.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: userMetadata,
        redirectTo,
      },
    });
    const setupLink =
      !backup.error && backup.data.properties?.action_link
        ? backup.data.properties.action_link
        : null;
    return { ok: true, userId, emailSent: true, setupLink };
  }

  if (isEmailAlreadyRegisteredError(invited.error)) {
    return { ok: false, error: "email_exists" };
  }

  const generated = await service.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: userMetadata,
      redirectTo,
    },
  });

  if (generated.error || !generated.data.user || !generated.data.properties?.action_link) {
    return { ok: false, error: "invite_failed" };
  }

  const userId = generated.data.user.id;
  await service.auth.admin.updateUserById(userId, { user_metadata: userMetadata });
  if (portalPending) {
    await stampPortalPendingDealerInvite(
      service,
      userId,
      portalPending.dealerId,
      portalPending.staffRole,
    );
  }
  return {
    ok: true,
    userId,
    emailSent: false,
    setupLink: generated.data.properties.action_link,
  };
}
