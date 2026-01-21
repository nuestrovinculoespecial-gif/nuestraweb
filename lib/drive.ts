import { google } from "googleapis";
import { Readable } from "stream";

function driveClient() {
   const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI!;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN!;
console.log("DRIVE OAUTH ENVS", {
  hasClientId: !!clientId,
  hasSecret: !!clientSecret,
  hasRedirect: !!redirectUri,
  refreshLen: refreshToken?.length ?? 0,
  redirect: redirectUri,
});
  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error("Faltan envs de OAuth (CLIENT_ID/SECRET/REDIRECT_URI/REFRESH_TOKEN)");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: oauth2 });
}
async function ensureAnyoneWithLinkReader(drive: any, fileId: string) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: "anyone",
        role: "reader",
        allowFileDiscovery: false,
      },
      // Si usas Shared Drives, descomenta:
      // supportsAllDrives: true,
    });
  } catch (e: any) {
    // Si ya existe el permiso, Drive a veces devuelve error; lo ignoramos
    // (para hacerlo idempotente y no frenar tu flujo)
    console.warn("ensureAnyoneWithLinkReader:", e?.message ?? e);
  }
}


async function findFolderByNameInParent(parentId: string, name: string) {
  const drive = driveClient();
  const safeName = name.replace(/'/g, "\\'");

  const q = [
    `'${parentId}' in parents`,
    `name = '${safeName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
  });

  return res.data.files?.[0] ?? null;
}

async function findFileInFolderByName(folderId: string, name: string) {
  const drive = driveClient();
  const safeName = name.replace(/'/g, "\\'");

  const q = [
    `'${folderId}' in parents`,
    `name = '${safeName}'`,
    `mimeType != 'application/vnd.google-apps.folder'`,
    "trashed = false",
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id,name,mimeType)",
    pageSize: 1,
  });

  return res.data.files?.[0] ?? null;
}

// ✅ Crea (o reutiliza) la carpeta del evento dentro de la raíz
export async function createEventFolder(folderName: string) {
  const drive = driveClient();
  const parentId = process.env.DRIVE_ROOT_FOLDER_ID!;
  if (!parentId) throw new Error("DRIVE_ROOT_FOLDER_ID no configurado");

  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
  });
  const folderId = res.data.id!;
  const name = res.data.name!;

  // ✅ CLAVE: hacer la carpeta pública (anyone with link)
  await ensureAnyoneWithLinkReader(drive, folderId);

  return { id: folderId, name };
 }


// ✅ Sube o reemplaza un archivo dentro de una carpeta
export async function uploadOrReplaceVideoToDrive(opts: {
  folderId: string;
  fileName: string; // ej: "video.mp4"
  file: File;
}) {
  const drive = driveClient();

  const arrayBuffer = await opts.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const existing = await findFileInFolderByName(opts.folderId, opts.fileName);

  if (existing?.id) {
    const upd = await drive.files.update({
      fileId: existing.id,
      media: {
        mimeType: opts.file.type || "video/mp4",
        body: Readable.from(buffer),
      },
      
      fields: "id",
    });

    return { fileId: upd.data.id!, mode: "replaced" as const };
  }

  const created = await drive.files.create({
    requestBody: {
      name: opts.fileName,
      parents: [opts.folderId],
    },
    media: {
      mimeType: opts.file.type || "video/mp4",
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  if (!created.data.id) throw new Error("No se pudo subir el archivo a Drive");
  return { fileId: created.data.id, mode: "created" as const };
}

export async function replaceDriveFileContent(opts: {
  fileId: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const drive = driveClient();

  const upd = await drive.files.update({
    fileId: opts.fileId,
    media: {
      mimeType: opts.mimeType || "video/mp4",
      body: Readable.from(opts.buffer),
    },
    fields: "id",
  });

  return { fileId: upd.data.id! };
}

