import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fp = (v?: string) =>
  v ? crypto.createHash("sha256").update(v).digest("hex").slice(0, 10) : null;

function envInfo(name: string) {
  const v = process.env[name];
  return { exists: !!v, len: v?.length ?? 0, fp: fp(v) };
}

export async function GET(req: Request) {
  // Protección con clave para que no pueda verlo cualquiera
  const key = req.headers.get("x-debug-key");
  if (!process.env.DEBUG_KEY || key !== process.env.DEBUG_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  return Response.json({
    stamp: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA,
      env: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      node: process.version,
    },
    GOOGLE_DRIVE_CLIENT_ID: envInfo("GOOGLE_DRIVE_CLIENT_ID"),
    GOOGLE_DRIVE_CLIENT_SECRET: envInfo("GOOGLE_DRIVE_CLIENT_SECRET"),
    GOOGLE_DRIVE_REFRESH_TOKEN: envInfo("GOOGLE_DRIVE_REFRESH_TOKEN"),
  });
}
