import { NextResponse } from "next/server";
import { createEventFolder } from "@/lib/drive";

export async function GET() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = await createEventFolder(`TEST Vinculo ${stamp}`);
    return NextResponse.json({ ok: true, folder });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

