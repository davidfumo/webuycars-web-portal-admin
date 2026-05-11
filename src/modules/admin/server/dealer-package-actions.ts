"use server";

import { revalidatePath } from "next/cache";
import { getPortalContext } from "@/lib/auth/portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type PackageMutationResult =
  | { ok: true }
  | {
      ok: false;
      code: "unauthorized" | "in_use" | "duplicate" | "validation" | "unknown";
      messageKey?: string;
    };

type SellerScope = Database["public"]["Tables"]["dealer_packages"]["Row"]["seller_scope"];

function slugify(raw: string) {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plan"
  );
}

function assertLocale(locale: string): locale is "en" | "pt" {
  return locale === "en" || locale === "pt";
}

function mapPgError(err: { code?: string | number; message?: string } | null): PackageMutationResult {
  if (!err) return { ok: false, code: "unknown" };
  const code = err.code != null ? String(err.code) : "";
  if (code === "23503") return { ok: false, code: "in_use" };
  if (code === "23505") return { ok: false, code: "duplicate" };
  return { ok: false, code: "unknown" };
}

async function requireAdmin(): Promise<PackageMutationResult | null> {
  const ctx = await getPortalContext();
  if (!ctx || ctx.surface !== "admin") {
    return { ok: false, code: "unauthorized" };
  }
  return null;
}

function revalidatePackageSurfaces(locale: "en" | "pt") {
  revalidatePath(`/${locale}/admin/packages`);
  revalidatePath(`/${locale}/admin/dealers/new`);
  revalidatePath(`/${locale}/dealer/onboarding`);
  revalidatePath(`/${locale}/dealer/subscription`);
}

function parseIntMin(name: string, raw: string, min: number): { ok: true; value: number } | PackageMutationResult {
  const n = Number.parseInt(raw.replace(/\s/g, ""), 10);
  if (!Number.isFinite(n) || n < min) {
    return { ok: false, code: "validation", messageKey: `field_${name}` };
  }
  return { ok: true, value: n };
}

function parseMoney(name: string, raw: string): { ok: true; value: number } | PackageMutationResult {
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, code: "validation", messageKey: `field_${name}` };
  }
  return { ok: true, value: n };
}

export type DealerPackageFormInput = {
  id?: string;
  name: string;
  slug: string;
  listing_limit: string;
  price: string;
  price_per_extra_listing: string;
  duration_days: string;
  featured_listing_allowance: string;
  sponsored_listing_allowance: string;
  priority_support: boolean;
  is_active: boolean;
  seller_scope: SellerScope;
};

export async function saveDealerPackage(
  locale: string,
  input: DealerPackageFormInput,
): Promise<PackageMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase() || slugify(name);
  if (!name) {
    return { ok: false, code: "validation", messageKey: "nameSlug" };
  }

  const lim = parseIntMin("listing_limit", input.listing_limit, 1);
  if (!("value" in lim)) return lim;
  const dur = parseIntMin("duration_days", input.duration_days, 1);
  if (!("value" in dur)) return dur;
  const feat = parseIntMin("featured_listing_allowance", input.featured_listing_allowance, 0);
  if (!("value" in feat)) return feat;
  const spon = parseIntMin("sponsored_listing_allowance", input.sponsored_listing_allowance, 0);
  if (!("value" in spon)) return spon;
  const price = parseMoney("price", input.price);
  if (!("value" in price)) return price;
  const extra = parseMoney("price_per_extra_listing", input.price_per_extra_listing);
  if (!("value" in extra)) return extra;

  const supabase = await createServerSupabaseClient();
  const row = {
    name,
    slug,
    listing_limit: lim.value,
    price: price.value,
    price_per_extra_listing: extra.value,
    duration_days: dur.value,
    featured_listing_allowance: feat.value,
    sponsored_listing_allowance: spon.value,
    priority_support: input.priority_support,
    is_active: input.is_active,
    seller_scope: input.seller_scope,
  };

  if (input.id) {
    const { error } = await supabase.from("dealer_packages").update(row).eq("id", input.id);
    if (error) return mapPgError(error);
  } else {
    const { error } = await supabase.from("dealer_packages").insert(row);
    if (error) return mapPgError(error);
  }

  revalidatePackageSurfaces(locale);
  return { ok: true };
}

export async function deleteDealerPackage(locale: string, id: string): Promise<PackageMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dealer_packages").delete().eq("id", id);
  if (error) return mapPgError(error);

  revalidatePackageSurfaces(locale);
  return { ok: true };
}
