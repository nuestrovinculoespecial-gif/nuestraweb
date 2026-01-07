import { createClientAction } from "./actions";

export default function NewClientPage() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Nuevo cliente</h1>

      <form action={createClientAction} className="space-y-3">
        <div>
          <label className="block text-sm">Nombre</label>
          <input name="nombre" className="w-full rounded border p-2" required />
        </div>

        <div>
          <label className="block text-sm">Email (opcional)</label>
          <input name="email" type="email" className="w-full rounded border p-2" />
        </div>

        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          Crear cliente
        </button>
      </form>
    </div>
  );
}
