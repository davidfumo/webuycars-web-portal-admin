import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DealerNotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getPortalContext();
  const t = await getTranslations("Notifications");
  if (!ctx || ctx.surface !== "dealer") return null;

  const { data: rows } = await supabase
    .from("notifications")
    .select("id,title,message,is_read,created_at,type")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>

      {(rows ?? []).length ? (
        <div className="space-y-3">
          {rows!.map((n) => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>{n.message}</div>
                <div className="text-xs">{new Date(n.created_at).toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
