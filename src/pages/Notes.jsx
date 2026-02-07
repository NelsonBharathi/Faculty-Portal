import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadToBucket } from "./_fileHelpers";

export default function Notes() {
  const { moduleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [module, setModule] = useState(null);
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  const bucket = "notes";

  async function load() {
    const p = await getMyProfile();
    setProfile(p);

    const { data: m } = await supabase.from("modules").select("*").eq("id", moduleId).single();
    setModule(m);

    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });

    setRows(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const canUpload = useMemo(() => !!profile, [profile]);

  async function onUpload() {
    setMsg("");
    try {
      if (!title.trim()) throw new Error("Enter a title");
      if (!file) throw new Error("Choose a file");

      const up = await uploadToBucket({
        bucket,
        file,
        folderPrefix: `${moduleId}/${profile.id}`,
      });

      const { error } = await supabase.from("notes").insert([
        {
          module_id: moduleId,
          title: title.trim(),
          file_path: up.path,
          uploader_id: profile.id,
        },
      ]);
      if (error) throw error;

      setTitle("");
      setFile(null);
      await load();
      setMsg("Uploaded!");
    } catch (e) {
      setMsg(e.message || "Upload failed");
    }
  }

  async function openSigned(path) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={module?.name || "Notes"} profile={profile} />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Upload (Teacher & Students)</div>
          <div className="text-sm text-gray-600">
            Students can upload but cannot delete. Teacher can manage.
          </div>

          <div className="mt-3 grid md:grid-cols-3 gap-2">
            <input
              className="border rounded-xl px-3 py-2 md:col-span-1"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canUpload}
            />
            <input
              className="border rounded-xl px-3 py-2 md:col-span-1"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={!canUpload}
            />
            <button
              className="rounded-xl bg-gray-900 text-white px-3 py-2 md:col-span-1"
              onClick={onUpload}
              disabled={!canUpload}
            >
              Upload
            </button>
          </div>

          {msg && <div className="mt-2 text-sm text-gray-700">{msg}</div>}
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Files</div>
          <div className="mt-3 space-y-2">
            {rows.length === 0 ? (
              <div className="text-sm text-gray-600">No notes yet.</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded-xl p-3">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-gray-500">
                      Uploaded: {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg border" onClick={() => openSigned(r.file_path)}>
                      View / Download
                    </button>

                    {profile?.role === "teacher" && (
                      <button
                        className="px-3 py-1.5 rounded-lg border text-red-600"
                        onClick={async () => {
                          // Teacher deletes row (and optionally file)
                          await supabase.from("notes").delete().eq("id", r.id);
                          // Optional: delete file too (teacher only)
                          await supabase.storage.from(bucket).remove([r.file_path]);
                          load();
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}