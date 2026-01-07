"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ClientsSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();

    if (!query) {
      router.push("/admin/clients");
      return;
    }

    setLoading(true);
    try {
      // Intento resolver como event_code
      const res = await fetch(`/admin/clients/resolve?q=${encodeURIComponent(query)}`, {
        method: "GET",
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json?.client_id) {
          router.push(`/admin/clients/${json.client_id}?focus_event=${json.events_id}`);
          return;
        }
      }

      // Si no es event_code, usamos búsqueda normal en /admin/clients?q=
      router.push(`/admin/clients?q=${encodeURIComponent(query)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex gap-2" onSubmit={onSubmit}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre, email, teléfono o event_code…"
        className="border rounded px-3 py-2 w-[360px]"
      />
      <button className="border rounded px-3 py-2" disabled={loading}>
        {loading ? "Buscando…" : "Buscar"}
      </button>
    </form>
  );
}
