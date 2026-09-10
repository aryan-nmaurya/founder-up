"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { invalidateLeaderboard } from "@/lib/ranking";
import { processRazorpayEvent, type RazorpayWebhook } from "@/lib/webhooks";

export type AdminState = { error?: string; ok?: boolean; message?: string };

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = requireAdminSupabase();
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

export async function setProfileFlagAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "") === "true";

  if (!id || !["is_suspended", "is_verified"].includes(field)) {
    return { error: "Invalid request." };
  }

  const supabase = requireAdminSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", id);

  if (error) return { error: error.message };

  await audit(admin.id, `PROFILE_${field.toUpperCase()}`, "profile", id, { value });
  invalidateLeaderboard();
  revalidatePath("/admin/founders");
  return { ok: true, message: "Updated" };
}

/** Plan §53 - manual adjustment, always with a reason, always ledgered. */
export async function adjustPointsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const points = Number(formData.get("points"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { error: "Missing founder." };
  if (!Number.isFinite(points) || points === 0) {
    return { error: "Enter a non-zero number of points." };
  }
  if (!reason) return { error: "A reason is required." };

  const supabase = requireAdminSupabase();
  const { error } = await supabase.rpc("admin_adjust_points", {
    p_founder_id: id,
    p_points: Math.trunc(points),
    p_reason: reason,
    p_actor_id: admin.id,
  });

  if (error) return { error: error.message };

  invalidateLeaderboard();
  revalidatePath("/admin/founders");
  return { ok: true, message: `Adjusted by ${Math.trunc(points)} RP` };
}

export async function setReportStatusAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["OPEN", "REVIEWING", "ACTIONED", "DISMISSED"].includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = requireAdminSupabase();
  const { error } = await supabase.from("reports").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  await audit(admin.id, "REPORT_STATUS", "report", id, { status });
  revalidatePath("/admin/reports");
  return { ok: true, message: "Updated" };
}

/** Plan §53 - retry a failed webhook without touching the database by hand. */
export async function retryWebhookAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing event." };

  const supabase = requireAdminSupabase();
  const { data: row } = await supabase
    .from("webhook_events")
    .select("id, payload, attempts")
    .eq("id", id)
    .maybeSingle();

  if (!row) return { error: "Event not found." };

  const event = (row as { payload: RazorpayWebhook }).payload;
  const attempts = (row as { attempts: number }).attempts ?? 0;

  try {
    const result = await processRazorpayEvent(event, supabase);
    await supabase
      .from("webhook_events")
      .update({
        status: result.status,
        error: result.detail ?? null,
        attempts: attempts + 1,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    await audit(admin.id, "WEBHOOK_RETRY", "webhook_event", id, {
      status: result.status,
    });
    revalidatePath("/admin/webhooks");
    return { ok: true, message: `Retried: ${result.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await supabase
      .from("webhook_events")
      .update({ status: "FAILED", error: message, attempts: attempts + 1 })
      .eq("id", id);
    revalidatePath("/admin/webhooks");
    return { error: message };
  }
}
