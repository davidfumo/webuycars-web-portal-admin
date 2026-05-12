"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

type Province = { id: string; name: string };
type Package = { id: string; name: string; price: number; listing_limit: number; duration_days: number };

type Props = {
  provinces: Province[];
  packages: Package[];
};

type CreateDealerSuccessBody = {
  dealerId?: string;
  subscriptionId?: string;
  managerUserId?: string;
  inviteEmailSent?: boolean;
  managerSetupLink?: string | null;
};

function mapDealerCreateError(code: string | undefined, tErr: (key: string) => string): string {
  switch (code) {
    case "unauthorized":
      return tErr("unauthorized");
    case "forbidden":
      return tErr("forbidden");
    case "service_role_missing":
      return tErr("service_role_missing");
    case "invalid_body":
      return tErr("invalid_body");
    case "auth_user_create_failed":
      return tErr("auth_user_create_failed");
    case "manager_email_exists":
      return tErr("manager_email_exists");
    case "dealer_insert_failed":
      return tErr("dealer_insert_failed");
    case "subscription_insert_failed":
      return tErr("subscription_insert_failed");
    case "staff_insert_failed":
      return tErr("staff_insert_failed");
    case "package_lookup_failed":
      return tErr("package_lookup_failed");
    case "payment_insert_failed":
      return tErr("payment_insert_failed");
    case "server_error":
      return tErr("server_error");
    default:
      return tErr("generic");
  }
}

function fileExtension(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (fromName && LOGO_ALLOWED_EXT.has(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return fromName;
}

export function NewDealerForm({ provinces, packages }: Props) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const tErr = useTranslations("AdminDealerCreate");
  const router = useRouter();
  const locale = useLocale();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [pending, setPending] = useState(false);
  const [setupLinkOpen, setSetupLinkOpen] = useState(false);
  const [managerSetupLink, setManagerSetupLink] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [provinceId, setProvinceId] = useState(provinces[0]?.id ?? "");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [managerEmail, setManagerEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  async function uploadLogoIfNeeded(): Promise<string | null> {
    if (!logoFile) return null;
    if (logoFile.size > LOGO_MAX_BYTES) {
      throw new Error("logo_too_large");
    }
    const ext = fileExtension(logoFile);
    if (!LOGO_ALLOWED_EXT.has(ext)) {
      throw new Error("logo_invalid_type");
    }
    const path = `pending/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("dealer-logos").upload(path, logoFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: logoFile.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });
    if (upErr) {
      throw new Error("logo_upload_failed");
    }
    const { data } = supabase.storage.from("dealer-logos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      let uploadedLogoUrl: string | null = null;
      try {
        uploadedLogoUrl = await uploadLogoIfNeeded();
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "logo_too_large") {
          toast.error(t("dealerLogoTooLarge"));
          return;
        }
        if (code === "logo_invalid_type") {
          toast.error(t("dealerLogoInvalidType"));
          return;
        }
        toast.error(t("dealerLogoUploadFailed"));
        return;
      }

      const res = await fetch("/api/admin/dealers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName,
          provinceId,
          contactEmail,
          contactPhone,
          address: address || undefined,
          packageId,
          managerEmail,
          logoUrl: uploadedLogoUrl,
          portalLocale: locale === "en" ? "en" : "pt",
        }),
      });
      const body = (await res.json()) as CreateDealerSuccessBody & { error?: string };
      if (!res.ok) {
        toast.error(mapDealerCreateError(typeof body?.error === "string" ? body.error : undefined, tErr));
        return;
      }

      const link = typeof body.managerSetupLink === "string" ? body.managerSetupLink : null;
      const emailed = body.inviteEmailSent !== false;

      if (link) {
        setManagerSetupLink(link);
        setSetupLinkOpen(true);
        toast.success(t("dealerCreatedWithManualInvite"));
        return;
      }

      toast.success(emailed ? t("dealerCreatedInviteEmailed") : t("dealerCreatedSuccess"));
      router.replace("/admin/dealers");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  function closeSetupDialog() {
    setSetupLinkOpen(false);
    setManagerSetupLink(null);
    router.replace("/admin/dealers");
    router.refresh();
  }

  async function copySetupLink() {
    if (!managerSetupLink) return;
    try {
      await navigator.clipboard.writeText(managerSetupLink);
      toast.success(t("dealerInviteLinkCopied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  return (
    <>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("dealerNew")}</CardTitle>
          <CardDescription>{tCommon("required")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{tCommon("name")}</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{tCommon("province")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={provinceId}
                  onChange={(e) => setProvinceId(e.target.value)}
                  required
                >
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("packagesTitle")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  required
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {Number(p.price).toLocaleString()} {tCommon("currency")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tCommon("email")}</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{tCommon("phone")}</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tCommon("address")}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("managerEmail")}</Label>
                <Input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("managerEmailHelp")}</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>
                  {t("dealerLogoLabel")} ({tCommon("optional")})
                </Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setLogoFile(f ?? null);
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("dealerLogoHint")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <LoadingButton type="submit" loading={pending}>
                {tCommon("create")}
              </LoadingButton>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
                {tCommon("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={setupLinkOpen} onOpenChange={(open) => !open && closeSetupDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dealerInviteLinkDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dealerInviteLinkDialogBody")}</DialogDescription>
          </DialogHeader>
          {managerSetupLink ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("dealerInviteLinkFieldLabel")}</Label>
              <Input readOnly value={managerSetupLink} className="font-mono text-xs" />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => void copySetupLink()}>
              {t("dealerInviteLinkCopy")}
            </Button>
            <Button type="button" onClick={closeSetupDialog}>
              {t("dealerInviteLinkGoToDealers")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
