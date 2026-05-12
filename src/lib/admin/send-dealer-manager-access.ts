import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const managerMeta = { role: "dealer_manager" } as const;

export type SendDealerManagerAccessResult =
  | { ok: true; inviteEmailSent: true; setupLink: null; linkKind: "invite" }
  | { ok: true; inviteEmailSent: false; setupLink: string; linkKind: "recovery" | "magiclink" }
  | { ok: false; error: "link_generation_failed" };

/**
 * Sends a new invite email, or generates a recovery / magic link for an existing manager account.
 */
export async function sendDealerManagerAccess(
  service: SupabaseClient<Database>,
  managerEmail: string,
  redirectTo: string,
): Promise<SendDealerManagerAccessResult> {
  const invited = await service.auth.admin.inviteUserByEmail(managerEmail, {
    data: { ...managerMeta },
    redirectTo,
  });

  if (!invited.error && invited.data.user) {
    await service.auth.admin.updateUserById(invited.data.user.id, {
      user_metadata: { ...managerMeta },
    });
    return { ok: true, inviteEmailSent: true, setupLink: null, linkKind: "invite" };
  }

  const recovery = await service.auth.admin.generateLink({
    type: "recovery",
    email: managerEmail,
    options: { redirectTo },
  });
  if (!recovery.error && recovery.data.properties?.action_link) {
    return {
      ok: true,
      inviteEmailSent: false,
      setupLink: recovery.data.properties.action_link,
      linkKind: "recovery",
    };
  }

  const magic = await service.auth.admin.generateLink({
    type: "magiclink",
    email: managerEmail,
    options: { redirectTo },
  });
  if (!magic.error && magic.data.properties?.action_link) {
    return {
      ok: true,
      inviteEmailSent: false,
      setupLink: magic.data.properties.action_link,
      linkKind: "magiclink",
    };
  }

  return { ok: false, error: "link_generation_failed" };
}
