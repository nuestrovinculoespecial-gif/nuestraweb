"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_BYTES = 10 * 1024 * 1024;

export default function UploadVideoClient({ publicCode }: { publicCode: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Consent UX
  const [modalOpen, setModalOpen] = useState(false);
  const [consentReady, setConsentReady] = useState(false); // habilita checkbox
  const [consentAccepted, setConsentAccepted] = useState(false);

  // DB logging
  const [cardId, setCardId] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  // Errores UX (mejor que alert)
  const [errorMsg, setErrorMsg] = useState<string>("");

  // (Opcional) habilitar “Aceptar” tras X ms para que no sea instantáneo
  const [acceptEnabled, setAcceptEnabled] = useState(false);
  useEffect(() => {
    if (!modalOpen) return;
    setAcceptEnabled(false);
    const t = setTimeout(() => setAcceptEnabled(true), 1200); // 1.2s
    return () => clearTimeout(t);
  }, [modalOpen]);

  async function fetchCardId() {
    if (cardId) return cardId;

    const { data, error } = await supabase
      .from("cards")
      .select("card_id")
      .eq("public_code", publicCode)
      .single();

    if (error || !data?.card_id) throw new Error("No se pudo identificar la tarjeta.");
    setCardId(data.card_id);
    return data.card_id as string;
  }

  async function onAcceptConsent() {
    setErrorMsg("");
    setStatus("");

    try {
      const cid = await fetchCardId();

      // Creamos log de subida (pending) en cuanto acepta.
      // Esto es “trazabilidad” del consentimiento del invitado.
      const { data, error } = await supabase
        .from("video_uploads")
        .insert({
          card_id: cid,
          status: "pending",
          consent_accepted: true,
          consent_version: "guest_v1",
          consent_at: new Date().toISOString(),
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        })
        .select("id")
        .single();

      if (error || !data?.id) throw error || new Error("No se pudo registrar el consentimiento.");

      setUploadId(data.id);
      setConsentReady(true);
      setConsentAccepted(true);
      setModalOpen(false);
      setStatus("Autorización aceptada. Ya puedes seleccionar tu vídeo.");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "No se pudo completar la autorización.");
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setStatus("");

    // Guardarraíl de consentimiento
    if (!consentAccepted || !uploadId) {
      setErrorMsg("Antes de subir el vídeo, lee y acepta la autorización.");
      e.target.value = "";
      return;
    }

    // 1) Límite de tamaño (10MB)
    if (file.size > MAX_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(
        `Este vídeo pesa ${sizeMb} MB. El máximo permitido es 10 MB. ` +
          `Si pesa más, envíatelo por WhatsApp o por email y vuelve a descargarlo ` +
          `para que se comprima.`
      );
      e.target.value = "";
      return;
    }

    setBusy(true);
    setStatus("Subiendo…");

    try {
      const ext = file.name.split(".").pop() || "mp4";
      const tempPath = `temp/${publicCode}/upload.${ext}`;

      // 2) Subir a Supabase Storage (tu flujo actual)
      setStatus("Subiendo el vídeo…");
      const { error: upErr } = await supabase.storage.from("videos").upload(tempPath, file, {
        upsert: true,
        contentType: file.type || "video/mp4",
      });
      if (upErr) throw upErr;

      // 3) Finalizar en Drive (tu API)
      setStatus("Procesando y guardando en Drive…");
      const res = await fetch(`/api/u/${publicCode}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPath, mimeType: file.type || "video/mp4" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Finalize failed (${res.status})`);

      // 4) Update del log (si tu API devuelve drive_file_id / driveFileId)
      const driveFileId = data?.drive_file_id || data?.driveFileId || null;

      const { error: logErr } = await supabase
        .from("video_uploads")
        .update({
          status: "uploaded",
          provider: "drive",
          provider_file_id: driveFileId,
          file_name: file.name,
          file_size_bytes: file.size,
        })
        .eq("id", uploadId);

      if (logErr) {
        // No rompemos la UX si esto falla: el vídeo ya se subió, pero lo registramos en status.
        console.warn("No se pudo actualizar video_uploads:", logErr);
      }

      setStatus("✅ Listo. Vídeo actualizado.");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "fallo subiendo");

      // Si falla, marcamos el log como failed (si existe)
      if (uploadId) {
        const { error: failErr } = await supabase
          .from("video_uploads")
          .update({ status: "failed" })
          .eq("id", uploadId);
        if (failErr) console.warn("No se pudo marcar failed:", failErr);
      }
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/80 font-medium">Selecciona tu vídeo</p>

      {/* Aviso 10MB */}
      <p className="mt-2 text-xs text-white/70">
        El vídeo debe pesar menos de <span className="font-semibold text-white/80">10 MB</span>.{" "}
        Si pesa más, envíatelo por WhatsApp o email y vuelve a descargarlo para que se comprima.
      </p>

      {/* Consent + Léeme */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/60">Antes de enviar tu vídeo</p>
            <p className="mt-1 text-sm text-white/80">
              Lee y acepta la autorización para poder subirlo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={busy}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            Léeme
          </button>
        </div>

        <label className="mt-3 flex items-start gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            className="mt-1"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            disabled={!consentReady || busy}
          />
          <span>
            He leído y acepto la autorización para subir este vídeo.
            <span className="block text-xs text-white/60 mt-1">
              (Se compartirá de forma privada con la familia.)
            </span>
          </span>
        </label>

        {!consentReady ? (
          <p className="mt-2 text-xs text-white/60">
            El checkbox se habilita cuando pulses “He leído y acepto” dentro de “Léeme”.
          </p>
        ) : null}
      </div>

      {/* Input: bloqueado hasta consentimiento */}
      <input
        type="file"
        accept="video/*"
        onChange={onPickFile}
        disabled={busy || !consentAccepted || !uploadId}
        className="mt-4 block w-full text-sm text-white/70"
        required
      />

      {/* Mensajes */}
      {errorMsg ? (
        <p className="mt-3 text-xs text-red-200/90 break-words">{errorMsg}</p>
      ) : null}

      {status ? (
        <p className="mt-3 text-xs text-white/70 break-words">{status}</p>
      ) : null}

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0B1020] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Antes de enviar tu vídeo</h3>
                <p className="mt-1 text-xs text-white/60">
                  Léelo con calma. Al aceptar, podrás subir el vídeo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 leading-relaxed">
              <p>
                Al subir este vídeo confirmo que lo hago de forma voluntaria para compartirlo de manera
                privada con la familia destinataria a través de Vínculo.
              </p>
              <p className="mt-3">
                Entiendo que el vídeo será almacenado en Google Drive y/o YouTube (modo no listado) y que solo
                será accesible mediante enlace privado.
              </p>
              <p className="mt-3">
                Vínculo no utilizará este vídeo con fines publicitarios ni lo hará público.
              </p>
              <p className="mt-3">
                El vídeo se conservará hasta que la familia solicite su eliminación.
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 text-sm text-white/80">
              <input type="checkbox" className="mt-1" disabled={busy} />
              <span>
                Confirmo que tengo permiso de las personas que aparecen en el vídeo (especialmente si hay menores).
                <span className="block text-xs text-white/60 mt-1">(Recomendado)</span>
              </span>
            </label>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onAcceptConsent}
                disabled={busy || !acceptEnabled}
                className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                He leído y acepto
              </button>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Volver
              </button>
            </div>

            {!acceptEnabled ? (
              <p className="mt-3 text-xs text-white/50">
                (Habilitando el botón…)
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
