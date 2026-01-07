"use client";

import { useMemo, useState } from "react";

type CardInput = { card_code: string; final_video_url: string };

export default function CreateEventPage() {
  const [cliente, setCliente] = useState({
    nombre_apellidos: "",
    telefono_contacto: "",
    email: "",
  });

  const [evento, setEvento] = useState({
    tipo_evento: "",
    fecha_evento: "",
    descripcion_evento: "",
    pagado: false,
  });

  const [cards, setCards] = useState<CardInput[]>([
    { card_code: "", final_video_url: "" },
  ]);

  const canSubmit = useMemo(() => {
    if (!cliente.nombre_apellidos.trim()) return false;
    if (!cliente.telefono_contacto.trim() && !cliente.email.trim()) return false;
    if (!evento.tipo_evento.trim()) return false;
    if (cards.length === 0) return false;
    return cards.every(c => c.card_code.trim() && c.final_video_url.trim());
  }, [cliente, evento, cards]);

  async function onSubmit() {
    const payload = {
      cliente: {
        nombre_apellidos: cliente.nombre_apellidos.trim(),
        telefono_contacto: cliente.telefono_contacto.trim() || undefined,
        email: cliente.email.trim() || undefined,
      },
      evento: {
        tipo_evento: evento.tipo_evento.trim(),
        fecha_evento: evento.fecha_evento || undefined,
        descripcion_evento: evento.descripcion_evento.trim() || undefined,
        pagado: evento.pagado,
      },
      cards: cards.map(c => ({
        card_code: c.card_code.trim(),
        final_video_url: c.final_video_url.trim(),
      })),
    };

    const r = await fetch("/api/admin/create-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      alert(data?.message || data?.error || "Error al crear el evento");
      return;
    }

    alert(`OK ✅ Evento creado: ${data.event.event_code} | Tarjetas: ${data.cards_count}`);

    // reset mínimo
    setEvento({ tipo_evento: "", fecha_evento: "", descripcion_evento: "", pagado: false });
    setCards([{ card_code: "", final_video_url: "" }]);
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Admin · Crear evento</h1>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Cliente</h2>

        <label style={{ display: "block", marginBottom: 8 }}>
          Nombre y apellidos *
          <input
            value={cliente.nombre_apellidos}
            onChange={(e) => setCliente({ ...cliente, nombre_apellidos: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Teléfono
          <input
            value={cliente.telefono_contacto}
            onChange={(e) => setCliente({ ...cliente, telefono_contacto: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            value={cliente.email}
            onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <p style={{ margin: 0, color: "#666" }}>
          * Necesitas nombre y al menos teléfono o email.
        </p>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Evento</h2>

        <label style={{ display: "block", marginBottom: 8 }}>
          Tipo de evento *
          <input
            value={evento.tipo_evento}
            onChange={(e) => setEvento({ ...evento, tipo_evento: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="Comunión, Cumpleaños..."
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Fecha
          <input
            type="date"
            value={evento.fecha_evento}
            onChange={(e) => setEvento({ ...evento, fecha_evento: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Descripción / notas
          <textarea
            value={evento.descripcion_evento}
            onChange={(e) => setEvento({ ...evento, descripcion_evento: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6, minHeight: 80 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={evento.pagado}
            onChange={(e) => setEvento({ ...evento, pagado: e.target.checked })}
          />
          Pagado
        </label>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Tarjetas</h2>

        {cards.map((c, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, marginBottom: 8 }}>
            <input
              placeholder="card_code (ej: CARD-0001)"
              value={c.card_code}
              onChange={(e) => {
                const next = [...cards];
                next[idx] = { ...next[idx], card_code: e.target.value };
                setCards(next);
              }}
              style={{ padding: 10 }}
            />
            <input
              placeholder="final_video_url"
              value={c.final_video_url}
              onChange={(e) => {
                const next = [...cards];
                next[idx] = { ...next[idx], final_video_url: e.target.value };
                setCards(next);
              }}
              style={{ padding: 10 }}
            />
            <button
              type="button"
              onClick={() => setCards(cards.filter((_, i) => i !== idx))}
              style={{ padding: "10px 12px" }}
              disabled={cards.length === 1}
            >
              X
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setCards([...cards, { card_code: "", final_video_url: "" }])}
          style={{ padding: "10px 12px" }}
        >
          + Añadir tarjeta
        </button>
      </section>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          border: "1px solid #000",
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        Guardar evento + tarjetas
      </button>
    </div>
  );
}
