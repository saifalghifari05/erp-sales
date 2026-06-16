import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Storage adapter foto customer.
 * Prioritas: Cloudflare R2 (S3-compatible via @aws-sdk/client-s3).
 * Fallback: Supabase Storage. Semua server-side; secret tidak ke browser.
 */

export type StorageProvider = "r2" | "supabase";

export function activeProvider(): StorageProvider {
  const hasR2 =
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME;
  return hasR2 ? "r2" : "supabase";
}

interface UploadResult {
  provider: StorageProvider;
  storage_path: string;
  public_url: string | null;
}

let _r2: S3Client | null = null;
function r2Client(): S3Client {
  if (_r2) return _r2;
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, "")
    || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  _r2 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _r2;
}

/** Upload buffer foto. data = base64 (tanpa prefix data URL). */
export async function uploadPhoto(
  orderId: string, fileName: string, mimeType: string, base64: string
): Promise<UploadResult> {
  const provider = activeProvider();
  const buffer = Buffer.from(base64, "base64");
  const path = `${orderId}/${crypto.randomUUID()}-${fileName}`;

  if (provider === "r2") {
    try {
      await r2Client().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: path,
        Body: buffer,
        ContentType: mimeType,
      }));
    } catch (e) {
      console.error("[R2 upload gagal]", e instanceof Error ? e.message : e);
      throw e;
    }
    const base = process.env.R2_PUBLIC_BASE_URL;
    return {
      provider: "r2",
      storage_path: path,
      public_url: base ? `${base.replace(/\/$/, "")}/${path}` : null,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from("customer-photos").upload(path, buffer, {
    contentType: mimeType, upsert: false,
  });
  if (error) {
    console.error("[Supabase upload gagal]", error.message);
    throw new Error("Upload Supabase gagal: " + error.message);
  }
  const { data } = admin.storage.from("customer-photos").getPublicUrl(path);
  return { provider: "supabase", storage_path: path, public_url: data?.publicUrl ?? null };
}

export async function deletePhotoFile(provider: string, path: string) {
  if (provider === "r2") {
    await r2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: path,
    }));
  } else {
    const admin = createAdminClient();
    await admin.storage.from("customer-photos").remove([path]);
  }
}
