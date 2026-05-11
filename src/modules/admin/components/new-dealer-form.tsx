"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Province = { id: string; name: string };
type Package = { id: string; name: string; price: number; listing_limit: number; duration_days: number };

type Props = {
  provinces: Province[];
  packages: Package[];
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
    case "dealer_insert_failed":
      return tErr("dealer_insert_failed");
    case "subscription_insert_failed":
      return tErr("subscription_insert_failed");
    case "staff_insert_failed":
      return tErr("staff_insert_failed");
    case "server_error":
      return tErr("server_error");
    default:
      return tErr("generic");
  }
}

export function NewDealerForm({ provinces, packages }: Props) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const tErr = useTranslations("AdminDealerCreate");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [provinceId, setProvinceId] = useState(provinces[0]?.id ?? "");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [managerEmail, setManagerEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
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
          logoUrl: logoUrl || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(mapDealerCreateError(typeof body?.error === "string" ? body.error : undefined, tErr));
        return;
      }
      toast.success(t("dealerCreatedSuccess"));
      router.replace("/admin/dealers");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
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
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Logo URL ({tCommon("optional")})</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
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
  );
}
