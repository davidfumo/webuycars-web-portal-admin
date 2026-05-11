"use server";

import { revalidatePath } from "next/cache";
import { getPortalContext } from "@/lib/auth/portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ReferenceMutationResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "in_use" | "duplicate" | "unknown"; message?: string };

function assertLocale(locale: string): locale is "en" | "pt" {
  return locale === "en" || locale === "pt";
}

function mapPgError(err: { code?: string | number; message?: string } | null): ReferenceMutationResult {
  if (!err) return { ok: false, code: "unknown" };
  const code = err.code != null ? String(err.code) : "";
  if (code === "23503") return { ok: false, code: "in_use", message: err.message };
  if (code === "23505") return { ok: false, code: "duplicate", message: err.message };
  return { ok: false, code: "unknown", message: err.message };
}

async function requireAdmin(): Promise<ReferenceMutationResult | null> {
  const ctx = await getPortalContext();
  if (!ctx || ctx.surface !== "admin") {
    return { ok: false, code: "unauthorized" };
  }
  return null;
}

function revalidateReference(locale: "en" | "pt", segment: "brands" | "models" | "body-types" | "provinces") {
  revalidatePath(`/${locale}/admin/config/${segment}`);
  if (segment === "brands") {
    revalidatePath(`/${locale}/admin/config/models`);
  }
}

/* -------------------------------------------------------------------------- */
/* Provinces                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveProvince(
  locale: string,
  input: { id?: string; name: string; slug: string; is_active: boolean },
): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  if (input.id) {
    const { error } = await supabase
      .from("provinces")
      .update({
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        is_active: input.is_active,
      })
      .eq("id", input.id);
    if (error) return mapPgError(error);
  } else {
    const { error } = await supabase.from("provinces").insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      is_active: input.is_active,
    });
    if (error) return mapPgError(error);
  }
  revalidateReference(locale, "provinces");
  return { ok: true };
}

export async function deleteProvince(locale: string, id: string): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("provinces").delete().eq("id", id);
  if (error) return mapPgError(error);
  revalidateReference(locale, "provinces");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Body types                                                                 */
/* -------------------------------------------------------------------------- */

export async function saveBodyType(
  locale: string,
  input: { id?: string; name: string; slug: string; is_active: boolean },
): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  if (input.id) {
    const { error } = await supabase
      .from("body_types")
      .update({
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        is_active: input.is_active,
      })
      .eq("id", input.id);
    if (error) return mapPgError(error);
  } else {
    const { error } = await supabase.from("body_types").insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      is_active: input.is_active,
    });
    if (error) return mapPgError(error);
  }
  revalidateReference(locale, "body-types");
  return { ok: true };
}

export async function deleteBodyType(locale: string, id: string): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("body_types").delete().eq("id", id);
  if (error) return mapPgError(error);
  revalidateReference(locale, "body-types");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Vehicle brands                                                             */
/* -------------------------------------------------------------------------- */

export async function saveVehicleBrand(
  locale: string,
  input: { id?: string; name: string; slug: string; is_active: boolean; logo_url: string | null },
): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const logo =
    input.logo_url && input.logo_url.trim().length > 0 ? input.logo_url.trim() : null;

  if (input.id) {
    const { error } = await supabase
      .from("vehicle_brands")
      .update({
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        is_active: input.is_active,
        logo_url: logo,
      })
      .eq("id", input.id);
    if (error) return mapPgError(error);
  } else {
    const { error } = await supabase.from("vehicle_brands").insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      is_active: input.is_active,
      logo_url: logo,
    });
    if (error) return mapPgError(error);
  }
  revalidateReference(locale, "brands");
  return { ok: true };
}

export async function deleteVehicleBrand(locale: string, id: string): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("vehicle_brands").delete().eq("id", id);
  if (error) return mapPgError(error);
  revalidateReference(locale, "brands");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Vehicle models                                                             */
/* -------------------------------------------------------------------------- */

export async function saveVehicleModel(
  locale: string,
  input: {
    id?: string;
    brand_id: string;
    name: string;
    slug: string;
    is_active: boolean;
  },
): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  if (input.id) {
    const { error } = await supabase
      .from("vehicle_models")
      .update({
        brand_id: input.brand_id,
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        is_active: input.is_active,
      })
      .eq("id", input.id);
    if (error) return mapPgError(error);
  } else {
    const { error } = await supabase.from("vehicle_models").insert({
      brand_id: input.brand_id,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      is_active: input.is_active,
    });
    if (error) return mapPgError(error);
  }
  revalidateReference(locale, "models");
  return { ok: true };
}

export async function deleteVehicleModel(locale: string, id: string): Promise<ReferenceMutationResult> {
  if (!assertLocale(locale)) return { ok: false, code: "unauthorized" };
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("vehicle_models").delete().eq("id", id);
  if (error) return mapPgError(error);
  revalidateReference(locale, "models");
  return { ok: true };
}
