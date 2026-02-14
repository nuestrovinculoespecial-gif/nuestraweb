import { createClient } from "@/lib/supabase/server";
import UploadVideoClient from "./UploadVideoClient";

export default async function UpdatePage({
  params,
  searchParams,
}: {
  params: Promise<{ public_code: string }>;
  searchParams?: Promise<{ debug?: string }>;
}) {
  const { public_code } = await params;
  const sp = (await searchParams) ?? {};
  const debug = sp.debug === "1";

  const supabase = await createClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select(
      // ✅ añadimos drive_file_id + initial_video_url para saber si ya hay vídeo
      "card_code, public_code, upload_enabled, upload_disabled_at, video_actualizado, drive_file_id, initial_video_url"
    )
    .eq("public_code", public_code)
    .single();

  const notFound = error || !card;

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0B1020] text-white">
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />

            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                Enlace no válido
              </p>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">
                No encontramos esta tarjeta
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Vuelve a escanear el QR de la etiqueta. Si el problema continúa,
                puede que el enlace esté incompleto.
              </p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">
                  Código recibido:
                  <span className="ml-2 font-mono text-white/80">
                    {public_code}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/40">Vínculo</p>
        </div>
      </div>
    );
  }

  const disabled = !card.upload_enabled;

  // ✅ “hay vídeo” = o bien ya existe el file en Drive, o bien ya hay url guardada
  const hasVideo = !!card.drive_file_id || !!card.initial_video_url;

  const StatusPill = ({
    tone,
    children,
  }: {
    tone: "ok" | "warn" | "neutral";
    children: React.ReactNode;
  }) => {
    const styles =
      tone === "ok"
        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
        : tone === "warn"
          ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
          : "border-white/10 bg-white/5 text-white/70";

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${styles}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {children}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl px-6 py-10">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-white/60">Vínculo</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Deja tu recuerdo en vídeo 💛
              </h1>
              <p className="mt-2 text-sm text-white/70">
                La familia lo recibirá de forma privada a través de esta moneda.
              </p>
            </div>

            <div className="w-full sm:w-auto sm:shrink-0">
              {debug ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white/60">Tarjeta</p>
                      <p className="mt-1 truncate text-sm font-medium">{card.card_code}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-white/60">Código</p>
                      <p className="mt-1 font-mono text-xs text-white/70">
                        {card.public_code}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/80">Tarjeta verificada ✅</p>
                  <p className="mt-1 text-xs text-white/60">
                    Este vídeo se compartirá de forma privada con la familia.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {/* ✅ pill correcta */}
            <StatusPill tone={hasVideo ? "ok" : "warn"}>
              {hasVideo ? "Vídeo listo para ver" : "Aún no hay vídeo"}
            </StatusPill>

            <StatusPill tone={disabled ? "neutral" : "ok"}>
              {disabled ? "Subida desactivada" : "Subida disponible"}
            </StatusPill>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white/60">Tarjeta</p>
                <p className="mt-1 truncate text-sm font-medium">
                  {card.card_code}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-white/60">Código</p>
                <p className="mt-1 font-mono text-xs text-white/70">
                  {card.public_code}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel principal */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          {disabled ? (
            <>
              <h2 className="text-lg font-semibold">Subida cerrada</h2>
              <p className="mt-2 text-sm text-white/70">
                Esta etiqueta ya no permite subir vídeos. Si necesitas reabrirlo,
                actívalo desde el panel de administración.
              </p>

              {card.upload_disabled_at ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Desactivado</p>
                  <p className="mt-1 text-sm text-white/80">
                    {new Date(card.upload_disabled_at).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                {hasVideo ? "Listo para actualizar" : "Listo para subir"}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {hasVideo
                  ? "Selecciona tu nuevo vídeo. Reemplazará el anterior y la familia lo verá en el mismo enlace."
                  : "Selecciona tu vídeo y súbelo. Quedará guardado de forma privada para la familia."}
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Consejos rápidos</p>
                <ul className="mt-2 space-y-2 text-sm text-white/75">
                  <li className="flex gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Mejor con Wi-Fi si el vídeo pesa mucho.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Si el audio es importante, graba en un lugar con poco ruido.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-0.5">•</span>
                    <span>
                      El vídeo debe pesar menos de 10 MB. Si pesa más, envíatelo por WhatsApp o email
                      y vuelve a descargarlo para que se comprima.
                    </span>
                  </li>
                  {hasVideo ? (
                    <li className="flex gap-2">
                      <span className="mt-0.5">•</span>
                      <span>Al subir, este vídeo quedará como el más reciente.</span>
                    </li>
                  ) : null}
                </ul>
              </div>

              <UploadVideoClient publicCode={public_code} />
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-white/35">Vínculo</p>
      </div>
    </div>
  );
}
