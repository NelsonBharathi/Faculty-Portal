import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const BUCKET = "hw-submissions"; // ✅ must match bucket

function toIsoDeadline(dateStr, hh, mm) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, Number(hh || 0), Number(mm || 0), 0);
  return dt.toISOString();
}

async function signedUrlForPath(path) {
  const clean = (path || "").replace(/^\/+/, "");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(clean, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export default function Homework() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const isTeacher = role === "teacher";

  const [homeworks, setHomeworks] = useState([]);
  const [subsByHomework, setSubsByHomework] = useState({});
  const [openFor, setOpenFor] = useState(null);

  // create homework
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [maxSubs, setMaxSubs] = useState(1);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineH, setDeadlineH] = useState("09");
  const [deadlineM, setDeadlineM] = useState("00");

  // student submit
  const [fileByHomework, setFileByHomework] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      setRole(prof?.role || null);
    })();
  }, []);

  const refresh = async () => {
    const { data, error } = await supabase.from("homeworks").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setHomeworks(data || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const createHomework = async () => {
    try {
      if (!isTeacher) return toast.error("Only teacher can create homework");
      if (!title.trim()) return toast.error("Title required");
      if (!deadlineDate) return toast.error("Deadline date required");

      const deadlineIso = toIsoDeadline(deadlineDate, deadlineH, deadlineM);

      const { error } = await supabase.from("homeworks").insert({
        title: title.trim(),
        description: desc?.trim() || null,
        max_submissions: Number(maxSubs || 1),
        deadline: deadlineIso,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Homework created");
      setTitle("");
      setDesc("");
      setMaxSubs(1);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Create failed");
    }
  };

  const loadSubs = async (hwId) => {
    const { data, error } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("homework_id", hwId)
      .order("submitted_at", { ascending: false });

    if (error) return toast.error(error.message);
    setSubsByHomework((p) => ({ ...p, [hwId]: data || [] }));
  };

  const submitHomework = async (hw) => {
    try {
      if (!user?.id) return toast.error("Login required");
      if (isTeacher) return toast.error("Teacher cannot submit");
      const file = fileByHomework[hw.id];
      if (!file) return toast.error("Choose a file");

      // enforce max submissions per student
      const { data: countRows } = await supabase
        .from("homework_submissions")
        .select("id", { count: "exact", head: true })
        .eq("homework_id", hw.id)
        .eq("student_id", user.id);

      // count is not always returned in data; do a safer query
      const { data: existing, error: exErr } = await supabase
        .from("homework_submissions")
        .select("id")
        .eq("homework_id", hw.id)
        .eq("student_id", user.id);

      if (exErr) throw exErr;
      if ((existing?.length || 0) >= Number(hw.max_submissions || 1)) {
        return toast.error("You reached max submissions for this homework");
      }

      const ext = file.name.split(".").pop() || "bin";
      const key = `${hw.id}/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      const { error } = await supabase.from("homework_submissions").insert({
        homework_id: hw.id,
        student_id: user.id,
        file_path: key,
        submitted_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Submitted");
      setFileByHomework((p) => ({ ...p, [hw.id]: null }));
      if (openFor === hw.id) await loadSubs(hw.id);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Submit failed");
    }
  };

  const openFile = async (row) => {
    try {
      const url = await signedUrlForPath(row.file_path); // ✅ fixed
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Cannot open file");
    }
  };

  const setVerified = async (rowId, v) => {
    try {
      if (!isTeacher) return toast.error("Only teacher");
      const { error } = await supabase
        .from("homework_submissions")
        .update({
          verified: !!v,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", rowId);

      if (error) throw error;
      toast.success("Saved");
      if (openFor) await loadSubs(openFor);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Save failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Homework</h1>
          <p className="text-sm text-muted-foreground">
            Teacher creates homework. Students submit. Teacher verifies submissions.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>Create Homework</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Homework title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input
                type="number"
                min={1}
                placeholder="Max submissions (per student)"
                value={maxSubs}
                onChange={(e) => setMaxSubs(e.target.value)}
              />
            </div>

            <Textarea placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
              <Input type="number" min={0} max={23} value={deadlineH} onChange={(e) => setDeadlineH(e.target.value)} />
              <Input type="number" min={0} max={59} value={deadlineM} onChange={(e) => setDeadlineM(e.target.value)} />
              <Button onClick={createHomework}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Homework List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {homeworks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No homework yet.</p>
          ) : (
            homeworks.map((hw) => {
              const subs = subsByHomework[hw.id] || [];
              return (
                <div key={hw.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{hw.title}</div>
                      {hw.description && <div className="text-sm text-muted-foreground">{hw.description}</div>}
                      <div className="text-sm text-muted-foreground mt-1">
                        Deadline: {hw.deadline ? new Date(hw.deadline).toLocaleString() : "—"} • Max:{" "}
                        {hw.max_submissions ?? 1}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (openFor === hw.id) return setOpenFor(null);
                          setOpenFor(hw.id);
                          await loadSubs(hw.id);
                        }}
                      >
                        {openFor === hw.id ? "Close" : "View submissions"}
                      </Button>
                    </div>
                  </div>

                  {!isTeacher && (
                    <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                      <Input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setFileByHomework((p) => ({
                            ...p,
                            [hw.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      <Button onClick={() => submitHomework(hw)}>Submit</Button>
                    </div>
                  )}

                  {openFor === hw.id && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Submissions ({subs.length})</div>
                        <Button variant="outline" onClick={() => loadSubs(hw.id)}>
                          Refresh submissions
                        </Button>
                      </div>

                      {subs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No submissions yet.</p>
                      ) : (
                        subs.map((s) => (
                          <div
                            key={s.id}
                            className="border rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="font-medium">Student:</span> {s.student_id}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Submitted:{" "}
                                {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                              </div>
                              <Button variant="link" className="p-0 h-auto" onClick={() => openFile(s)}>
                                Open
                              </Button>
                            </div>

                            {isTeacher ? (
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={!!s.verified} onCheckedChange={(v) => setVerified(s.id, v)} />
                                Verified
                              </label>
                            ) : (
                              <div className="text-sm text-muted-foreground">Verified: {s.verified ? "Yes" : "No"}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}