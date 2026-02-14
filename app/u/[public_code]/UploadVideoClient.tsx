"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UploadVideoClient({ publicCode }: { publicCode: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [accepted, setAccepted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const maxMb = 10;

  async function uploadFlow(file: File) {
    setBusy(true);
    setStatus("Subiendo…");

    try {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxMb) {
        throw new Error(`El vídeo pesa ${sizeMb.toFixed(1)}MB. Máximo: ${maxMb}MB.`);
      }

      const ext = file.name.split(".").pop() || "mp4";
      const tempPath = `temp/${publicCode}/upload.${ext}`;

      setStatus("1/2 Subiendo a Supabase…");
      const { error } = await supabase.storage
        .from("videos")
        .upload(tempPath, file, {
          upsert: true,
          contentType: file.type || "video/mp4",
        });

      if (error) throw error;

      setStatus("2/2 Enviando a Drive…");
      const res = await fetch(`/api/u/${publicCode}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPath, mimeType: file.type }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Finalize failed");

      setStatus("✅ Listo. Vídeo enviado.");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message || "Error subiendo"}`);
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
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      {/* Modal info */}
      {showInfo ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0B1020] p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/60">Antes de subir</p>
                <h3 className="mt-1 text-lg font-semibold">Información importante</h3>
              </div>

              <button
                onClick={() => setShowInfo(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-white/75">
              <p>
                Este vídeo se compartirá <b>solo</b> con la familia de forma privada.
              </p>
              <p>
                No subas datos sensibles ni información personal innecesaria.
              </p>
              <p>
                Si en el vídeo aparecen <b>menores</b>, confirma que tienes permiso para grabarlos y compartirlo con la familia.
              </p>
              <p>
                Límite actual: <b>{maxMb} MB</b>. Si pesa más, puedes enviártelo por WhatsApp o email y volver a descargarlo para que se comprima.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/60">
                El consentimiento se acepta con el checkbox de la pantalla principal.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-white/80 font-medium">Selecciona tu vídeo</p>

      {/* ✅ Un solo checkbox */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={busy}
          />
          <div className="min-w-0">
            <p className="text-sm text-white/85">
              He leído y acepto la autorización para subir este vídeo.
            </p>
            <p className="mt-1 text-xs text-white/60">
              Incluye consentimiento para grabación y compartir con la familia si aparecen menores. Se compartirá de forma privada.
            </p>
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
            >
              Leer detalles
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={onPickFile}
        className="hidden"
        disabled={busy || !accepted}
      />

      {/* ✅ Botón grande */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || !accepted}
        className={`mt-4 w-full rounded-2xl px-4 py-4 text-base font-semibold shadow-lg transition
          ${busy || !accepted
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : "bg-white text-black hover:bg-white/90"}
        `}
      >
        {busy ? "Subiendo…" : "Seleccionar vídeo"}
      </button>

      <p className="mt-2 text-xs text-white/50">
        Límite actual: {maxMb} MB.
      </p>

      {status ? (
        <p className="mt-3 text-xs text-white/70 break-words">{status}</p>
      ) : null}
    </div>
  );
}
