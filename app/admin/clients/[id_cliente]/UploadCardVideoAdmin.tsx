"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  cardId: string;
  clientId: string;
};

export default function UploadCardVideoAdmin({ cardId, clientId }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const maxMb = 25;

  async function uploadFlow(file: File) {
    setBusy(true);
    setStatus("Subiendo a Supabase…");

    try {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxMb) {
        throw new Error(`El vídeo pesa ${sizeMb.toFixed(1)}MB. Máximo: ${maxMb}MB.`);
      }

      const ext = file.name.split(".").pop() || "mp4";
      const tempPath = `admin-temp/${clientId}/${cardId}/upload.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(tempPath, file, {
          upsert: true,
          contentType: file.type || "video/mp4",
        });

      if (uploadError) throw uploadError;

      setStatus("Procesando vídeo…");

      const res = await fetch(`/api/admin/cards/${cardId}/finalize-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          cardId,
          tempPath,
          mimeType: file.type || "video/mp4",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error al finalizar la subida");
      }

      setStatus("✅ Vídeo subido correctamente");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message || "Error subiendo el vídeo"}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadFlow(file);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={onPickFile}
        className="hidden"
        disabled={busy}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded bg-black px-3 py-2 text-white text-sm disabled:opacity-50"
      >
        {busy ? "Subiendo…" : "Subir / reemplazar"}
      </button>

      <span className="text-xs text-gray-500">
        Máximo actual: {maxMb} MB
      </span>

      {status ? (
        <div className="basis-full text-xs text-gray-600 break-words">
          {status}
        </div>
      ) : null}
    </div>
  );
}