import { supabase } from "../lib/supabase";

export async function uploadToBucket({ bucket, file, folderPrefix }) {
  const ext = file.name.split(".").pop();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folderPrefix}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;

  // Create a signed URL for viewing/downloading (private buckets)
  const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (signErr) throw signErr;

  return { path, signedUrl: signed.signedUrl };
}