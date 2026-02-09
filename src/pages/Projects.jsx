import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const BUCKET = "project-reports"; // ✅ must match bucket

async function signedUrlForPath(path) {
  const clean = (path || "").replace(/^\/+/, "");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(clean, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export default function Projects() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const isTeacher = role === "teacher";

  const [items, setItems] = useState([]);

  // student submission fields
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState(""); // optional external video link
  const [reportFile, setReportFile] = useState(null); // pdf

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);

      const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setRole(prof?.role || null);
    })();
  }, []);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("project_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return toast.error(error.message);
    setItems(data || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const submitProject = async () => {
    try {
      if (!user?.id) return toast.error("Login required");
      if (isTeacher) return toast.error("Teacher cannot submit project");
      if (!title.trim()) return toast.error("Title required");
      if (!reportFile) return toast.error("Report PDF required");

      const ext = reportFile.name.split(".").pop() || "pdf";
      const key = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, reportFile, {
        upsert: false,
        contentType: reportFile.type || "application/pdf",
      });
      if (upErr) throw upErr;

      const { error } = await supabase.from("project_submissions").insert({
        student_id: user.id,
        title: title.trim(),
        description: desc?.trim() || null,
        repo_url: repoUrl?.trim() || null,
        live_url: liveUrl?.trim() || null,
        demo_url: demoUrl?.trim() || null,
        report_path: key,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Project submitted");
      setTitle("");
      setDesc("");
      setRepoUrl("");
      setLiveUrl("");
      setDemoUrl("");
      setReportFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Submit failed");
    }
  };

  const openReport = async (row) => {
    try {
      if (!row?.report_path) return toast.error("No report path");
      const url = await signedUrlForPath(row.report_path); // ✅ fixed
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Cannot open report");
    }
  };

  const saveTeacherReview = async (rowId, patch) => {
    try {
      if (!isTeacher) return toast.error("Only teacher");
      const { error } = await supabase
        .from("project_submissions")
        .update({
          ...patch,
          graded_by: user?.id,
          graded_at: new Date().toISOString(),
        })
        .eq("id", rowId);

      if (error) throw error;
      toast.success("Saved");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Save failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Students submit report + links. Teacher verifies and gives marks.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {!isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Project</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input placeholder="Project title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Repo URL (optional)" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
              <Input placeholder="Live URL (optional)" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
              <Input placeholder="Demo video link (optional)" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
            </div>
            <Input type="file" accept="application/pdf" onChange={(e) => setReportFile(e.target.files?.[0] || null)} />
            <Button onClick={submitProject}>Submit</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No project submissions yet.</p>
          ) : (
            items.map((p) => (
              <div key={p.id} className="border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
                    <div className="text-sm text-muted-foreground mt-1">
                      Student: {p.student_id}
                    </div>
                    <div className="text-sm mt-2 flex flex-wrap gap-3">
                      {p.repo_url && (
                        <a className="underline" href={p.repo_url} target="_blank" rel="noreferrer">
                          Repo
                        </a>
                      )}
                      {p.live_url && (
                        <a className="underline" href={p.live_url} target="_blank" rel="noreferrer">
                          Live
                        </a>
                      )}
                      {p.demo_url && (
                        <a className="underline" href={p.demo_url} target="_blank" rel="noreferrer">
                          Demo Video
                        </a>
                      )}
                      {p.report_path && (
                        <button className="underline" onClick={() => openReport(p)}>
                          Open Report
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Marks: {p.marks ?? "—"} • Verified: {p.verified ? "Yes" : "No"}
                  </div>
                </div>

                {isTeacher && (
                  <div className="flex flex-col md:flex-row gap-2 md:items-center pt-2 border-t">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!p.verified}
                        onCheckedChange={(v) =>
                          saveTeacherReview(p.id, {
                            verified: !!v,
                            verified_by: user?.id,
                            verified_at: new Date().toISOString(),
                          })
                        }
                      />
                      Verified
                    </label>

                    <Input
                      type="number"
                      min={0}
                      placeholder="Marks"
                      defaultValue={p.marks ?? ""}
                      onBlur={(e) =>
                        saveTeacherReview(p.id, { marks: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      className="w-32"
                    />

                    <Input
                      placeholder="Feedback"
                      defaultValue={p.feedback ?? ""}
                      onBlur={(e) => saveTeacherReview(p.id, { feedback: e.target.value || null })}
                      className="w-72"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}