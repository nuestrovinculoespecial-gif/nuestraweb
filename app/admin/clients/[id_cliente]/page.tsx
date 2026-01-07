import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createEventAction, generateCardsForEvent } from "./actions";
import { uploadCardVideoAction } from "./actions";
import ClientDetail from "../_components/ClientDetail";
import QRCode from "qrcode";



function NewEventForm({ id_cliente }: { id_cliente: string }) {
  return (
    <div className="rounded border p-3 space-y-3">
      <h2 className="font-semibold">Nuevo evento</h2>

      <form action={createEventAction} className="space-y-3">
        <input type="hidden" name="id_cliente" value={id_cliente} />

        {/* Tipo de evento */}
        <div>
          <label className="block text-sm">Tipo de evento</label>
          <select
            name="tipo_evento"
            className="w-full rounded border p-2"
            required
            defaultValue="comunión"
          >
            <option value="comunión">Comunión</option>
            <option value="bautizo">Bautizo</option>
            <option value="boda">Boda</option>
            <option value="futbol">Fútbol</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {/* Modalidad de vídeo */}
        <div>
          <label className="block text-sm">Modalidad de vídeo</label>
          <select
            name="modalidad_video"
            className="w-full rounded border p-2"
            required
            defaultValue="upgrade"
          >
            <option value="upgrade">
              Upgrade (Drive: se puede actualizar)
            </option>
            <option value="fix">
              Fix (YouTube: vídeo fijo)
            </option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">numero_tags_diferentes</label>
            <input
              name="numero_tags_diferentes"
              type="number"
              min={0}
              className="w-full rounded border p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm">numero_tags_tipo</label>
            <input
              name="numero_tags_tipo"
              type="number"
              min={0}
              className="w-full rounded border p-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">fecha_evento</label>
            <input
              name="fecha_evento"
              type="date"
              className="w-full rounded border p-2"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm mt-6">
            <input name="pagado" type="checkbox" />
            Pagado
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input name="generate_cards" type="checkbox" defaultChecked />
          Generar cards al crear el evento
        </label>

        <button
          className="rounded bg-black px-3 py-2 text-white"
          type="submit"
        >
          Crear evento
        </button>
      </form>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id_cliente: string }>;
}) {
  const { id_cliente } = await params; // ✅ unwrap

  const clientId = Number(id_cliente);

  if (!Number.isFinite(clientId)) {
    throw new Error("id_cliente inválido");
  }

  const supabase = await createClient();

  const { data: client, error: clientErr } = await supabase
    .from("clientes")
    .select("*")
    .eq("id_cliente", clientId)
    .single();
  if (clientErr) throw new Error(clientErr.message);

  const { data: events, error: eventsErr } = await supabase
    .from("Eventos")
    .select(
      "events_id, created_at, fecha_evento, tipo_evento, event_code, pagado, numero_tags_diferentes, num_tags_tipo, modalidad_video"
    )
    .eq("id_cliente", clientId)
    .order("created_at", { ascending: false });
  if (eventsErr) throw new Error(eventsErr.message);

  const eventIds = (events ?? []).map((e) => e.events_id);
  console.log("eventIds:", eventIds, "types:", eventIds.map((x) => typeof x));
  const { data: cards, error: cardsErr } = eventIds.length
    ? await supabase
      .from("cards")
      .select("card_id, created_at, initial_video_url, video_actualizado, drive_file_id, card_code, event_fk, recording_status")
      .in("event_fk", eventIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null as any };

  if (cardsErr) throw new Error(cardsErr.message);
  // Generar QR (dataURL) por cada card, usando initial_video_url
  const qrByCardId = new Map<string, string>();

  await Promise.all(
    (cards ?? []).map(async (c) => {
      if (!c.initial_video_url) return;
      const dataUrl = await QRCode.toDataURL(c.initial_video_url, {
        margin: 1,
        width: 180,
      });
      qrByCardId.set(String(c.card_id), dataUrl);
    })
  );

  return (
    <div className="p-6 space-y-6 scroll-smooth">
      <Link className="underline text-sm" href="/admin/clients">
        ← Volver a clientes
      </Link>

      {/* Header ficha cliente */}
      <div className="rounded border p-4 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {client?.nombre ?? `Cliente #${clientId}`}
            </h1>

            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600">
              <span className="rounded border px-2 py-1 bg-gray-50">
                {events?.length ?? 0} evento(s)
              </span>
              <span className="rounded border px-2 py-1 bg-gray-50">
                {cards?.length ?? 0} card(s)
              </span>
            </div>
          </div>

          {/* CTA simple: baja al formulario */}
          <a
            href="#nuevo-evento"
            className="rounded bg-black px-4 py-2 text-white whitespace-nowrap"
          >
            + Nuevo evento
          </a>
        </div>
      </div>

      {/* Eventos (mantenemos ClientDetail tal cual por ahora) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Eventos</h2>
        {/* Lista UI de eventos (solo visual) */}
        {/* Lista UI de eventos (desplegable con cards) */}
        <div className="space-y-3">
          {(events ?? []).length === 0 ? (
            <div className="rounded border p-4 bg-white text-sm text-gray-600">
              Este cliente aún no tiene eventos.
            </div>
          ) : (
            <div className="grid gap-3">
              {(events ?? []).map((e, idx) => {
                const eventCards = (cards ?? []).filter((c) => c.event_fk === e.events_id);

                const expected =
                  (e.numero_tags_diferentes ?? 0) * (e.num_tags_tipo ?? 0);

                const missing =
                  expected > 0 ? Math.max(expected - eventCards.length, 0) : null;

                return (
                  <details
                    key={e.events_id}
                    className="rounded border bg-white"
                    open={idx === 0} // opcional: abre el más reciente
                  >
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{e.tipo_evento ?? "Evento"}</span>
                            {e.event_code ? (
                              <span className="text-xs text-gray-500">{e.event_code}</span>
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            <span
                              className={`rounded border px-2 py-1 ${e.pagado ? "bg-green-50" : "bg-amber-50"
                                }`}
                            >
                              {e.pagado ? "Pagado" : "Pendiente"}
                            </span>

                            <span className="rounded border px-2 py-1 bg-gray-50">
                              Cards: {eventCards.length}
                              {expected > 0 ? ` / ${expected}` : ""}
                            </span>

                            {missing !== null ? (
                              <span
                                className={`rounded border px-2 py-1 ${missing === 0 ? "bg-green-50" : "bg-amber-50"
                                  }`}
                              >
                                {missing === 0 ? "Completas" : `Faltan ${missing}`}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <span className="text-xs text-gray-500 mt-1">Ver cards ▾</span>
                      </div>
                    </summary>

                    <div className="border-t p-4">
                      {eventCards.length === 0 ? (
                        <div className="text-sm text-gray-600">
                          Este evento aún no tiene cards.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {eventCards.map((c) => (
                            <div key={c.card_id} className="rounded border p-3 text-sm bg-white">
                              <div className="flex items-center justify-between gap-3">
                                <div className="mt-3 flex items-center gap-4">
                                  <div className="shrink-0 rounded bg-white p-2 border">
                                    {c.initial_video_url ? (
                                      <img
                                        src={qrByCardId.get(String(c.card_id))}
                                        alt={`QR ${c.card_code ?? ""}`}
                                        className="h-32 w-32"
                                      />
                                    ) : (
                                      <div className="h-32 w-32 grid place-items-center text-xs text-gray-500">
                                        Sin URL
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="text-xs text-gray-500 break-all">
                                      {c.initial_video_url ?? ""}
                                    </div>

                                    {/* Estado interno de grabación (si lo quieres visible) */}
                                    {"recording_status" in c ? (
                                      <div className="mt-2 text-xs">
                                        <span className="rounded border px-2 py-1 bg-gray-50">
                                          {c.recording_status}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <span className="font-medium">
                                  {c.card_code ?? `Card #${c.card_id}`}
                                </span>

                                <span
                                  className={`rounded border px-2 py-1 text-xs ${c.video_actualizado ? "bg-green-50" : "bg-gray-50"
                                    }`}
                                >
                                  {c.video_actualizado ? "Vídeo OK" : "Pendiente"}
                                </span>
                                {e.modalidad_video === "upgrade" ? (
                                  <form action={uploadCardVideoAction} className="mt-3 flex flex-wrap items-center gap-2">
                                    <input type="hidden" name="card_id" value={c.card_id} />
                                    <input type="hidden" name="client_id" value={clientId} />

                                    <input
                                      type="file"
                                      name="video"
                                      accept="video/*"
                                      className="text-sm"
                                      required
                                    />

                                    <button className="rounded bg-black px-3 py-2 text-white text-sm" type="submit">
                                      {c.drive_file_id ? "Reemplazar" : "Subir"}
                                    </button>
                                  </form>
                                ) : null}

                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        {/* <ClientDetail client={client} events={events ?? []} cards={cards ?? []} /> */}

      </div>

      {/* Formulario nuevo evento abajo */}
      <div id="nuevo-evento" className="space-y-3">
        <h2 className="text-lg font-semibold">Crear evento</h2>
        <NewEventForm id_cliente={String(clientId)} />
      </div>
    </div>
  );

}
