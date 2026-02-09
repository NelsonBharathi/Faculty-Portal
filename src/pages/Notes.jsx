import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BUCKET = "notes"; // ✅ must match your Supabase bucket name exactly

async function getProfileRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function signedUrlForPath(path) {
  const clean = (path || "").replace(/^\/+/, "");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(clean, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export default function Notes() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const isTeacher = role === "teacher";

  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);

      try {
        const p = await getProfileRole(data.user.id);
        setRole(p.role);
      } catch (e) {
        console.error(e);
        toast.error("Unable to load profile");
      }
    })();
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const uploadNote = async () => {
    try {
      if (!user?.id) return toast.error("Login required");
      if (!title.trim()) return toast.error("Title required");
      if (!file) return toast.error("Choose a file");

      const ext = file.name.split(".").pop() || "bin";
      const key = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      // upload to correct bucket ✅
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      // insert DB row
      const { error } = await supabase.from("notes").insert({
        title: title.trim(),
        file_path: key,
        uploader_id: user.id,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Note uploaded");
      setTitle("");
      setFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Upload failed");
    }
  };

  const openFile = async (row) => {
    try {
      if (!row?.file_path) return toast.error("No file path found");
      const url = await signedUrlForPath(row.file_path); // ✅ FIXED OPEN
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Cannot open file");
    }
  };

  const deleteNote = async (row) => {
    try {
      if (!isTeacher) return toast.error("Only teacher can delete");
      if (!row?.id) return;

      // delete DB row
      const { error } = await supabase.from("notes").delete().eq("id", row.id);
      if (error) throw error;

      // optional: delete storage file too (recommended)
      if (row.file_path) {
        await supabase.storage.from(BUCKET).remove([row.file_path]);
      }

      toast.success("Deleted");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Delete failed (check RLS policy)");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Students can upload but cannot delete. Teacher can manage.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload (Teacher & Students)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button onClick={uploadNote}>Upload</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Uploaded: {n.created_at ? new Date(n.created_at).toLocaleString() : "—"}
                  </div>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => openFile(n)}
                  >
                    Open / Download
                  </Button>
                </div>

                {isTeacher && (
                  <Button variant="destructive" onClick={() => deleteNote(n)}>
                    Delete
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}