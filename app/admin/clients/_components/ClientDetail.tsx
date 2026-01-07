"use client";


import { toggleVideoActualizado } from "../actions";
import { useEffect, useMemo, useTransition } from "react";
import { useSearchParams } from "next/navigation";


export default function ClientDetail({
  client,
  events,
  cards,
}: {
  client: any;
  events: any[];
  cards: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const sp = useSearchParams();

useEffect(() => {
  const focus = sp.get("focus_event");
  if (!focus) return;

  const el = document.getElementById(`event-${focus}`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}, [sp]);


  const cardsByEvent = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const c of cards) {
      const k = c.event_fk as number;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [cards]);

  const copy = async (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-6">
      <div className="border rounded p-4">
        <div className="text-lg font-semibold">
          {client.nombre_apellidos ?? `Cliente #${client.id_cliente}`}
        </div>
        <div className="text-sm text-muted-foreground">
          {client.email ?? "-"} · {client.telefono_contacto ?? "-"}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Eventos</h2>

        {events.map((e) => {
          const eventCards = cardsByEvent.get(e.events_id) ?? [];
           const urls = Number(e.numero_tags_diferentes ?? 0);
          const porUrl = Number(e.num_tags_tipo ?? 0);
          const totalTeorico = urls * porUrl;
          return (
            <div
                key={e.events_id}
                id={`event-${e.events_id}`}
                className="border rounded"
                >
                
              <div className="p-4 flex items-start justify-between gap-3 border-b">
                <div>
                  <div className="font-medium">
                    {e.tipo_evento ?? "Evento"} · #{e.events_id}
                  </div>
                   <div className="text-sm text-muted-foreground">
                     code: {e.event_code ?? "-"} · fecha: {e.fecha_evento ?? "-"} · pagado: {e.pagado ? "sí" : "no"}
                   {" · "}
                   urls: {urls || "-"} · por url: {porUrl || "-"} · total: {totalTeorico || "-"}
                    </div>
                </div>

                <div className="flex gap-2">
                  {e.event_code && (
                    <button
                      className="border rounded px-3 py-2 text-sm"
                      onClick={() => copy(`${location.origin}/e/${e.event_code}`)} // ajusta ruta pública
                    >
                      Copiar link evento
                    </button>
                  )}
                  <a className="border rounded px-3 py-2 text-sm" href={`/admin/events/${e.events_id}`}>
                    Ver evento
                  </a>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {eventCards.map((c) => (
                  <div key={c.card_id} className="flex items-center justify-between gap-3 border rounded p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.card_code ?? c.card_id}</div>
                      <div className="text-xs text-muted-foreground">
                        video_actualizado: {c.video_actualizado ? "true" : "false"}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {c.card_code && (
                        <button
                          className="border rounded px-3 py-2 text-sm"
                          onClick={() => copy(`${location.origin}/c/${c.card_code}`)} // ajusta ruta pública
                        >
                          Copiar link
                        </button>
                      )}
                      <button
                        className="border rounded px-3 py-2 text-sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => toggleVideoActualizado(c.card_id, client.id_cliente))
                        }
                      >
                        Toggle video
                      </button>
                    </div>
                  </div>
                ))}

                {eventCards.length === 0 && (
                  <div className="text-sm text-muted-foreground">Sin tarjetas en este evento.</div>
                )}
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="text-sm text-muted-foreground">Este cliente no tiene eventos.</div>
        )}
      </div>
    </div>
  );
}
