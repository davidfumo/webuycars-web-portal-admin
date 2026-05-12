"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { AppUserRole } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/ui/separator";

export type DealerTeamMemberRow = {
  staffId: string;
  userId: string;
  portalRole: "manager" | "staff";
  appRole: string | null;
  email: string | null;
  isActive: boolean;
  /** Manager still completing first-time onboarding (password / profile / payment). */
  setupPending: boolean;
};

function appRoleLabel(role: string | null, tUsers: ReturnType<typeof useTranslations<"UsersAdmin">>) {
  if (!role) return "—";
  switch (role as AppUserRole) {
    case "admin":
      return tUsers("role_admin");
    case "buyer":
      return tUsers("role_buyer");
    case "seller":
      return tUsers("role_seller");
    case "private_seller":
      return tUsers("role_private_seller");
    case "dealer":
      return tUsers("role_dealer");
    case "dealer_manager":
      return tUsers("role_dealer_manager");
    case "dealer_staff":
      return tUsers("role_dealer_staff");
    default:
      return role;
  }
}

function portalRoleLabel(
  role: DealerTeamMemberRow["portalRole"],
  t: ReturnType<typeof useTranslations<"Admin">>,
) {
  return role === "manager" ? t("dealerTeamPortalRole_manager") : t("dealerTeamPortalRole_staff");
}

function mapLinkExistingError(code: string | undefined, t: (k: string) => string) {
  switch (code) {
    case "unauthorized":
      return t("dealerAdminErrUnauthorized");
    case "forbidden":
      return t("dealerAdminErrForbidden");
    case "service_role_missing":
      return t("dealerAdminErrService");
    case "invalid_body":
      return t("dealerAdminErrInvalid");
    case "invalid_id":
      return t("dealerAdminErrInvalid");
    case "dealer_not_found":
      return t("dealerTeamLinkErrDealerNotFound");
    case "user_not_found":
      return t("dealerTeamLinkErrUserNotFound");
    case "ambiguous_email":
      return t("dealerTeamLinkErrAmbiguousEmail");
    case "cannot_link_admin":
      return t("dealerTeamLinkErrCannotAdmin");
    case "user_lookup_failed":
      return t("dealerTeamLinkErrUserLookup");
    case "staff_insert_failed":
    case "staff_update_failed":
      return t("dealerTeamLinkErrStaffWrite");
    case "manager_email_missing":
      return t("dealerAdminErrResendManagerEmailMissing");
    case "link_generation_failed":
      return t("dealerAdminErrResendLinkFailed");
    default:
      return t("dealerAdminErrGeneric");
  }
}

function mapManagerResendError(code: string | undefined, t: (k: string) => string) {
  switch (code) {
    case "unauthorized":
      return t("dealerAdminErrUnauthorized");
    case "forbidden":
      return t("dealerAdminErrForbidden");
    case "service_role_missing":
      return t("dealerAdminErrService");
    case "invalid_body":
      return t("dealerAdminErrInvalid");
    case "manager_not_found":
      return t("dealerAdminErrResendManagerNotFound");
    case "manager_email_missing":
      return t("dealerAdminErrResendManagerEmailMissing");
    case "link_generation_failed":
      return t("dealerAdminErrResendLinkFailed");
    default:
      return t("dealerAdminErrGeneric");
  }
}

type Props = {
  dealerId: string;
  members: DealerTeamMemberRow[];
};

export function DealerDetailTeamPanel({ dealerId, members }: Props) {
  const t = useTranslations("Admin");
  const tUsers = useTranslations("UsersAdmin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [resendPending, setResendPending] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPending, setLinkPending] = useState(false);

  const managerRow = members.find((m) => m.portalRole === "manager" && m.isActive);
  const showLinkExistingForm = !managerRow;

  async function linkExistingManager() {
    const email = linkEmail.trim();
    if (!email) {
      toast.error(tCommon("error"));
      return;
    }
    setLinkPending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealerId}/manager/link-existing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          portalLocale: locale === "en" ? "en" : "pt",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapLinkExistingError(typeof body?.error === "string" ? body.error : undefined, t));
        return;
      }
      const link = typeof body.setupLink === "string" ? body.setupLink : null;
      if (link) {
        setSetupLink(link);
        setLinkOpen(true);
        toast.success(t("dealerTeamLinkManagerSuccessManual"));
        setLinkEmail("");
        return;
      }
      toast.success(t("dealerTeamLinkManagerSuccessEmail"));
      setLinkEmail("");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setLinkPending(false);
    }
  }

  async function resendManagerAccess() {
    setResendPending(true);
    try {
      const res = await fetch(`/api/admin/dealers/${dealerId}/manager/resend-access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portalLocale: locale === "en" ? "en" : "pt" }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapManagerResendError(typeof body?.error === "string" ? body.error : undefined, t));
        return;
      }
      const link = typeof body.setupLink === "string" ? body.setupLink : null;
      if (link) {
        setSetupLink(link);
        setLinkOpen(true);
        toast.success(t("dealerAdminResendManagerManual"));
      } else {
        toast.success(t("dealerAdminResendManagerEmail"));
        router.refresh();
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setResendPending(false);
    }
  }

  async function copyLink() {
    if (!setupLink) return;
    try {
      await navigator.clipboard.writeText(setupLink);
      toast.success(t("dealerAdminResendLinkCopied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  function closeLinkDialog() {
    setLinkOpen(false);
    setSetupLink(null);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("dealerTeamTitle")}</CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                {t("dealerTeamIntro")}
              </CardDescription>
            </div>
            {managerRow ? (
              <LoadingButton
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                loading={resendPending}
                disabled={!managerRow.email}
                onClick={() => void resendManagerAccess()}
              >
                {t("dealerAdminResendManagerButton")}
              </LoadingButton>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {showLinkExistingForm ? (
            <div className="mb-6 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">{t("dealerTeamLinkManagerTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("dealerTeamLinkManagerHint")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="dealer-link-manager-email" className="text-xs">
                    {tCommon("email")}
                  </Label>
                  <Input
                    id="dealer-link-manager-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("dealerTeamLinkManagerPlaceholder")}
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                <LoadingButton
                  type="button"
                  variant="default"
                  size="sm"
                  className="shrink-0"
                  loading={linkPending}
                  disabled={!linkEmail.trim()}
                  onClick={() => void linkExistingManager()}
                >
                  {t("dealerTeamLinkManagerSubmit")}
                </LoadingButton>
              </div>
            </div>
          ) : null}

          {!members.length ? (
            <p className="text-sm text-muted-foreground">
              {showLinkExistingForm ? t("dealerTeamEmptyHint") : tCommon("noData")}
            </p>
          ) : (
            <>
              {showLinkExistingForm ? <Separator className="mb-6" /> : null}
              <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">{tCommon("email")}</th>
                  <th className="py-2 pr-3">{tUsers("dealerTeamColPortal")}</th>
                  <th className="py-2 pr-3">{tUsers("dealerTeamColAccount")}</th>
                  <th className="py-2 pr-3">{t("dealerTeamColSetup")}</th>
                  <th className="py-2">{tCommon("status")}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.staffId} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">
                      {m.email ?? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {m.userId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{portalRoleLabel(m.portalRole, t)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{appRoleLabel(m.appRole, tUsers)}</td>
                    <td className="py-2 pr-3">
                      {m.portalRole === "manager" && m.setupPending ? (
                        <Badge variant="warning">{t("dealerTeamSetupPending")}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant={m.isActive ? "success" : "secondary"}>
                        {m.isActive ? tCommon("active") : tCommon("inactive")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onOpenChange={(o) => !o && closeLinkDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dealerAdminResendLinkDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dealerAdminResendLinkDialogBody")}</DialogDescription>
          </DialogHeader>
          {setupLink ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("dealerAdminResendLinkField")}</Label>
              <Input readOnly value={setupLink} className="font-mono text-xs" />
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyLink()}>
              {t("dealerAdminResendLinkCopy")}
            </Button>
            <Button type="button" onClick={closeLinkDialog}>
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
