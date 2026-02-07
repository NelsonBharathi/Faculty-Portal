import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function Videos() {
  const { moduleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [module, setModule] = useState(null);

  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");

  const isTeacher = profile?.role === "teacher";

  async function load() {
    const p = await getMyProfile();
    setProfile(p);

    const { data: m } = await supabase
      .from("modules")
      .select("*")
      .eq("id", moduleId)
      .single();
    setModule(m);

    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });

    setRows(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  async function addVideo() {
    setMsg("");
    try {
      if (!isTeacher) throw new Error("Only teacher can add videos");
      if (!title.trim()) throw new Error("Enter title");
      if (!url.trim()) throw new Error("Enter URL");

      const { error } = await supabase.from("videos").insert([
        { module_id: moduleId, title: title.trim(), url: url.trim(), created_by: profile.id },
      ]);
      if (error) throw error;

      setTitle("");
      setUrl("");
      setMsg("Video added!");
      await load();
    } catch (e) {
      setMsg(e.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={module?.name || "Videos"} profile={profile} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {msg && (
          <div className="bg-white border rounded-2xl p-3 text-sm text-gray-700">
            {msg}
          </div>
        )}

        {isTeacher && (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Add Reference Video</div>
            <div className="mt-3 grid md:grid-cols-3 gap-2">
              <input
                className="border rounded-xl px-3 py-2 md:col-span-1"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2 md:col-span-1"
                placeholder="Video URL (YouTube / Drive / etc.)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                className="rounded-xl bg-gray-900 text-white px-3 py-2 md:col-span-1"
                onClick={addVideo}
              >
                Add
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Video Links</div>
          <div className="mt-3 space-y-2">
            {rows.length === 0 ? (
              <div className="text-sm text-gray-600">No videos yet.</div>
            ) : (
              rows.map((v) => (
                <div key={v.id} className="border rounded-xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{v.title}</div>
                    <div className="text-xs text-gray-500">{new Date(v.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className="px-3 py-1.5 rounded-lg border"
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>

                    {isTeacher && (
                      <button
                        className="px-3 py-1.5 rounded-lg border text-red-600"
                        onClick={async () => {
                          await supabase.from("videos").delete().eq("id", v.id);
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