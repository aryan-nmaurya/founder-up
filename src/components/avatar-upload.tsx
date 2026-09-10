"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_BYTES } from "@/lib/config";
import { FounderAvatar } from "./founder-avatar";

/**
 * Plan §57 - avatar only, 2 MB cap, JPEG/PNG/WebP.
 * Uploads go straight to Supabase Storage under the user's own folder, which
 * is the only path their storage policy allows them to write to.
 */
export function AvatarUpload({
  name,
  initialUrl,
  founderName,
  userId,
}: {
  name: string;
  initialUrl: string | null;
  founderName: string;
  userId: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!IMAGE_ACCEPTED_TYPES.includes(file.type as never)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("That image is over 2 MB.");
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setError("Storage isn't configured on this deployment.");
      return;
    }

    setBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("media").getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <FounderAvatar src={url || null} name={founderName} size={64} />
      <input type="hidden" name={name} value={url} />

      <div>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong px-3 text-[13px] font-medium hover:bg-surface">
          {busy ? "Uploading…" : url ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept={IMAGE_ACCEPTED_TYPES.join(",")}
            className="sr-only"
            disabled={busy}
            onChange={upload}
          />
        </label>
        {url ? (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="ml-2 text-[13px] text-muted hover:text-fg"
          >
            Remove
          </button>
        ) : null}
        <p className="mt-1 text-[12px] text-subtle">JPEG, PNG or WebP. Max 2 MB.</p>
        {error ? <p className="mt-1 text-[12px] text-negative">{error}</p> : null}
      </div>
    </div>
  );
}
