import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppUserRole } from "@/lib/database.types";
import { AdminInviteAdminForm } from "@/modules/admin/components/admin-invite-admin-form";

export const dynamic = "force-dynamic";

const SEGMENTS = ["all", "admin", "dealer", "private"] as const;
type Segment = (typeof SEGMENTS)[number];

function isSegment(s: string | undefined): s is Segment {
  return SEGMENTS.includes(s as Segment);
}

const DEALER_ROLES: AppUserRole[] = ["dealer", "dealer_manager", "dealer_staff"];
const PRIVATE_ROLES: AppUserRole[] = ["buyer", "seller", "private_seller"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ segment?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const segment = isSegment(sp.segment) ? sp.segment : "all";

  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("UsersAdmin");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  let query = supabase
    .from("users")
    .select("id,email,role,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (segment === "admin") {
    query = query.eq("role", "admin");
  } else if (segment === "dealer") {
    query = query.in("role", DEALER_ROLES);
  } else if (segment === "private") {
    query = query.in("role", PRIVATE_ROLES);
  }

  const { data: rows } = await query;

  function href(next: Segment) {
    return next === "all" ? "/admin/users" : `/admin/users?segment=${next}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tNav("adminUsers")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("inviteAdminSection")}
        </h2>
        <AdminInviteAdminForm />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SEGMENTS.map((s) => (
          <Link
            key={s}
            href={href(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              segment === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`filter_${s}`)}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("email")}</th>
                <th className="px-4 py-3">{t("colRole")}</th>
                <th className="px-4 py-3">{t("colJoined")}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{t(`role_${u.role}` as "role_admin")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
