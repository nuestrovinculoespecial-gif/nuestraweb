"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UploadVideoClient({ publicCode }: { publicCode: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus("Subiendo a Supabase…");

    try {
      const ext = file.name.split(".").pop() || "mp4";
      const tempPath = `temp/${publicCode}/upload.${ext}`;

      const { error } = await supabase.storage
        .from("videos")
        .upload(tempPath, file, {
          upsert: true,
          contentType: file.type || "video/mp4",
        });

      if (error) throw error;

      setStatus(`OK. Subido a Supabase: ${tempPath}`);
      // En el paso 3 llamaremos aquí a /api/u/[public_code]/finalize
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err?.message || "fallo subiendo"}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/80 font-medium">Selecciona tu vídeo</p>

      <input
        type="file"
        accept="video/*"
        onChange={onPickFile}
        disabled={busy}
        className="mt-3 block w-full text-sm text-white/70"
      />

      {status ? (
        <p className="mt-3 text-xs text-white/70 break-words">{status}</p>
      ) : null}

      <p className="mt-2 text-xs text-white/45">
        (Paso 2) Ahora solo subimos a Supabase temporal.
      </p>
    </div>
  );
}
