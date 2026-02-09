import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { getUserAndRole } from "@/lib/profile";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABLE = "videos";

function fmt(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function Videos() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const isTeacher = role === "teacher";
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      let r = await supabase.from(TABLE).select("*").order("created_at", { ascending: false });
      if (r.error) r = await supabase.from(TABLE).select("*");
      if (r.error) throw r.error;
      setRows(r.data || []);
    } catch (e) {
      toast.error(e?.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const r = await getUserAndRole();
      setUser(r.user);
      setRole(r.role);
      await fetchAll();
    })();
  }, []);

  const add = async () => {
    if (!user) return toast.error("Login required");
    if (!title.trim()) return toast.error("Title required");
    if (!url.trim()) return toast.error("URL required");

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        url: url.trim(),
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) throw error;

      toast.success("Added");
      setTitle("");
      setUrl("");
      await fetchAll();
    } catch (e) {
      toast.error(e?.message || "Insert failed (RLS/columns)");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!isTeacher) return toast.error("Only teacher can delete");
    setLoading(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      await fetchAll();
    } catch (e) {
      toast.error(e?.message || "Delete failed (RLS)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Videos"
      subtitle={user ? `Faculty Portal • ${role}` : ""}
      userEmail={user?.email}
      role={role}
      right={
        <Button variant="secondary" className="rounded-xl" onClick={fetchAll} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Add Reference Video</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 1 - Introduction" />
          </div>
          <div className="grid gap-2">
            <Label>Video URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <Button className="rounded-xl" onClick={add} disabled={loading}>
            {loading ? "Adding..." : "Add Link"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Video Links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">No links yet.</div>}

          {rows.map((v) => (
            <div key={v.id} className="rounded-2xl border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{v.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fmt(v.created_at)} • by {(v.created_by || "").toString().slice(0, 10)}…
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="rounded-xl" onClick={() => window.open(v.url, "_blank")}>
                      Open
                    </Button>
                  </div>
                </div>

                {isTeacher && (
                  <Button variant="destructive" className="rounded-xl" onClick={() => del(v.id)} disabled={loading}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}