"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: appUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || appUser.role !== "admin") {
    throw new Error("forbidden");
  }

  return { supabase, userId: user.id };
}

export async function publishListing(listingId: string) {
  const { supabase, userId } = await assertAdmin();

  const { error: logError } = await supabase.from("listing_moderation_logs").insert({
    listing_id: listingId,
    moderator_id: userId,
    action: "approved",
    reason: null,
  });
  if (logError) throw logError;

  const { error } = await supabase
    .from("vehicle_listings")
    .update({ status: "published" })
    .eq("id", listingId);

  if (error) throw error;
  revalidatePath("/admin/listings");
}

export async function rejectListingFormAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!listingId) throw new Error("missing_listing");
  await rejectListing(listingId, reason || "—");
}

export async function rejectListing(listingId: string, reason: string) {
  const { supabase, userId } = await assertAdmin();

  const { error: logError } = await supabase.from("listing_moderation_logs").insert({
    listing_id: listingId,
    moderator_id: userId,
    action: "rejected",
    reason,
  });
  if (logError) throw logError;

  const { error } = await supabase
    .from("vehicle_listings")
    .update({ status: "rejected" })
    .eq("id", listingId);

  if (error) throw error;
  revalidatePath("/admin/listings");
}
