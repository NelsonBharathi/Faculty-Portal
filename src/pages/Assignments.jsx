import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// shadcn/ui (you already have these in your project)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const BUCKET = "as-submissions"; // ✅ must match Supabase bucket exactly

function toIsoDeadline(dateStr, hh, mm) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, Number(hh || 0), Number(mm || 0), 0);
  return dt.toISOString();
}

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

export default function Assignments() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  // create assignment
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState(10);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineH, setDeadlineH] = useState("12");
  const [deadlineM, setDeadlineM] = useState("00");

  // list
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // submissions
  const [openFor, setOpenFor] = useState(null); // assignment_id currently expanded
  const [subsByAssignment, setSubsByAssignment] = useState({}); // { [assignment_id]: submissions[] }

  // student upload submission
  const [fileByAssignment, setFileByAssignment] = useState({}); // { [assignment_id]: File }

  const isTeacher = role === "teacher";

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
        toast.error("Unable to load profile role");
      }
    })();
  }, []);

  const refreshAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAssignments();
  }, []);

  const createAssignment = async () => {
    try {
      if (!isTeacher) return toast.error("Only teacher can create assignments");
      if (!title.trim()) return toast.error("Title is required");
      if (!deadlineDate) return toast.error("Deadline date is required");

      const deadlineIso = toIsoDeadline(deadlineDate, deadlineH, deadlineM);

      const { error } = await supabase.from("assignments").insert({
        title: title.trim(),
        description: desc?.trim() || null,
        points: Number(points || 0),
        deadline: deadlineIso,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Assignment created");
      setTitle("");
      setDesc("");
      setPoints(10);
      await refreshAssignments();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Create failed");
    }
  };

  const deleteAssignment = async (assignmentId) => {
    try {
      if (!isTeacher) return toast.error("Only teacher can delete");
      // delete submissions first (DB rows only; files remain in storage unless you delete them separately)
      await supabase.from("assignment_submissions").delete().eq("assignment_id", assignmentId);

      const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
      if (error) throw error;

      toast.success("Assignment deleted");
      if (openFor === assignmentId) setOpenFor(null);
      await refreshAssignments();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Delete failed (check RLS policy)");
    }
  };

  const loadSubmissions = async (assignmentId) => {
    try {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      setSubsByAssignment((prev) => ({ ...prev, [assignmentId]: data || [] }));
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load submissions");
    }
  };

  const toggleSubmissions = async (assignmentId) => {
    if (openFor === assignmentId) {
      setOpenFor(null);
      return;
    }
    setOpenFor(assignmentId);
    await loadSubmissions(assignmentId);
  };

  const submitAssignment = async (assignmentId) => {
    try {
      if (!user?.id) return toast.error("Login required");
      if (isTeacher) return toast.error("Teacher cannot submit");
      const file = fileByAssignment[assignmentId];
      if (!file) return toast.error("Choose a file");

      const ext = file.name.split(".").pop() || "bin";
      const key = `${assignmentId}/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      // upload to correct bucket ✅
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      // insert submission row
      const { error } = await supabase.from("assignment_submissions").insert({
        assignment_id: assignmentId,
        student_id: user.id,
        file_path: key,
        submitted_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Submitted");
      setFileByAssignment((p) => ({ ...p, [assignmentId]: null }));
      if (openFor === assignmentId) await loadSubmissions(assignmentId);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Submit failed");
    }
  };

  const openSubmissionFile = async (row) => {
    try {
      if (!row?.file_path) return toast.error("No file path found");
      const url = await signedUrlForPath(row.file_path); // ✅ signed URL fix
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Unable to open file");
    }
  };

  const updateGrade = async (rowId, patch) => {
    try {
      if (!isTeacher) return toast.error("Only teacher can grade");

      const { error } = await supabase
        .from("assignment_submissions")
        .update({
          ...patch,
          graded_by: user?.id,
          graded_at: new Date().toISOString(),
        })
        .eq("id", rowId);

      if (error) throw error;

      toast.success("Saved");
      if (openFor) await loadSubmissions(openFor);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Save failed (check RLS policy)");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Teacher creates assignments. Students submit. Teacher verifies + marks + feedback.
          </p>
        </div>
        <Button variant="outline" onClick={refreshAssignments}>
          Refresh
        </Button>
      </div>

      {isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>Create Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input
                type="number"
                min={0}
                placeholder="Points"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                type="number"
                min={0}
                max={23}
                placeholder="HH"
                value={deadlineH}
                onChange={(e) => setDeadlineH(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                max={59}
                placeholder="MM"
                value={deadlineM}
                onChange={(e) => setDeadlineM(e.target.value)}
              />
              <Button onClick={createAssignment}>Create</Button>
            </div>

            <Textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignments List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            assignments.map((a) => {
              const subs = subsByAssignment[a.id] || [];
              return (
                <div key={a.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      {a.description && (
                        <div className="text-sm text-muted-foreground">{a.description}</div>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">
                        Deadline: {a.deadline ? new Date(a.deadline).toLocaleString() : "—"} • Points:{" "}
                        {a.points ?? 0}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => toggleSubmissions(a.id)}>
                        {openFor === a.id ? "Close" : "View submissions"}
                      </Button>
                      {isTeacher && (
                        <Button variant="destructive" onClick={() => deleteAssignment(a.id)}>
                          Delete Assignment
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isTeacher && (
                    <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                      <Input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setFileByAssignment((p) => ({
                            ...p,
                            [a.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      <Button onClick={() => submitAssignment(a.id)}>Submit</Button>
                    </div>
                  )}

                  {openFor === a.id && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Submissions ({subs.length})</div>
                        <Button variant="outline" onClick={() => loadSubmissions(a.id)}>
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
                              <Button variant="link" className="p-0 h-auto" onClick={() => openSubmissionFile(s)}>
                                View / Download
                              </Button>
                            </div>

                            {/* Teacher grading controls */}
                            {isTeacher ? (
                              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={!!s.verified}
                                    onCheckedChange={(v) => updateGrade(s.id, { verified: !!v })}
                                  />
                                  Verified
                                </label>

                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="Marks"
                                  value={s.marks ?? ""}
                                  onChange={(e) =>
                                    setSubsByAssignment((prev) => ({
                                      ...prev,
                                      [a.id]: prev[a.id].map((x) =>
                                        x.id === s.id ? { ...x, marks: e.target.value } : x
                                      ),
                                    }))
                                  }
                                  onBlur={(e) =>
                                    updateGrade(s.id, {
                                      marks: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="w-32"
                                />

                                <Input
                                  placeholder="Feedback"
                                  value={s.feedback ?? ""}
                                  onChange={(e) =>
                                    setSubsByAssignment((prev) => ({
                                      ...prev,
                                      [a.id]: prev[a.id].map((x) =>
                                        x.id === s.id ? { ...x, feedback: e.target.value } : x
                                      ),
                                    }))
                                  }
                                  onBlur={(e) => updateGrade(s.id, { feedback: e.target.value || null })}
                                  className="w-64"
                                />
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                Verified: {s.verified ? "Yes" : "No"} • Marks: {s.marks ?? "—"} • Feedback:{" "}
                                {s.feedback ?? "—"}
                              </div>
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