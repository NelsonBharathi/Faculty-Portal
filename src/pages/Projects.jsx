import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadToBucket } from "./_fileHelpers";

export default function Projects() {
  const { moduleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [module, setModule] = useState(null);

  const [projects, setProjects] = useState([]);
  const [gradesByProject, setGradesByProject] = useState({}); // { projectId: grade }

  // student upload project
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [reportFile, setReportFile] = useState(null);

  // teacher grading
  const [marksById, setMarksById] = useState({});
  const [fbById, setFbById] = useState({});

  const [msg, setMsg] = useState("");

  const bucket = "project-reports";
  const isTeacher = profile?.role === "teacher";
  const isStudent = profile?.role === "student";

  async function load() {
    const p = await getMyProfile();
    setProfile(p);

    const { data: m } = await supabase
      .from("modules")
      .select("*")
      .eq("id", moduleId)
      .single();
    setModule(m);

    const { data: pr } = await supabase
      .from("projects")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });

    setProjects(pr || []);

    const gradeMap = {};
    for (const proj of pr || []) {
      const { data: g } = await supabase
        .from("project_grades")
        .select("*")
        .eq("project_id", proj.id)
        .maybeSingle();
      if (g) gradeMap[proj.id] = g;
    }
    setGradesByProject(gradeMap);

    // prefill teacher UI
    if (p?.role === "teacher") {
      const m1 = {};
      const f1 = {};
      for (const proj of pr || []) {
        const g = gradeMap[proj.id];
        if (g) {
          m1[proj.id] = g.marks;
          f1[proj.id] = g.feedback || "";
        } else {
          m1[proj.id] = "";
          f1[proj.id] = "";
        }
      }
      setMarksById(m1);
      setFbById(f1);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  async function submitProject() {
    setMsg("");
    try {
      if (!isStudent) throw new Error("Only students can upload projects");
      if (!title.trim()) throw new Error("Enter project title");

      let report_path = null;
      if (reportFile) {
        const up = await uploadToBucket({
          bucket,
          file: reportFile,
          folderPrefix: `${moduleId}/${profile.id}`,
        });
        report_path = up.path;
      }

      const { error } = await supabase.from("projects").insert([
        {
          module_id: moduleId,
          title: title.trim(),
          description: desc.trim() || null,
          demo_url: demoUrl.trim() || null,
          report_path,
          student_id: profile.id,
        },
      ]);
      if (error) throw error;

      setTitle("");
      setDesc("");
      setDemoUrl("");
      setReportFile(null);
      setMsg("Project uploaded!");
      await load();
    } catch (e) {
      setMsg(e.message || "Upload failed");
    }
  }

  async function openSigned(path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function saveGrade(projectId) {
    setMsg("");
    try {
      if (!isTeacher) throw new Error("Only teacher can grade");
      const marks = Number(marksById[projectId]);
      if (Number.isNaN(marks) || marks < 0) throw new Error("Enter valid marks (0 or more)");

      // Upsert: insert if not exists, else update
      const { error } = await supabase
        .from("project_grades")
        .upsert(
          [
            {
              project_id: projectId,
              teacher_id: profile.id,
              marks,
              feedback: fbById[projectId] || null,
            },
          ],
          { onConflict: "project_id" }
        );

      if (error) throw error;
      setMsg("Grade saved!");
      await load();
    } catch (e) {
      setMsg(e.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={module?.name || "Projects"} profile={profile} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {msg && (
          <div className="bg-white border rounded-2xl p-3 text-sm text-gray-700">
            {msg}
          </div>
        )}

        {isStudent && (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Upload Mini Project</div>
            <div className="text-sm text-gray-600">
              Add a demo link (YouTube/GitHub Pages) and upload report if needed.
            </div>

            <div className="mt-3 grid md:grid-cols-2 gap-2">
              <input
                className="border rounded-xl px-3 py-2"
                placeholder="Project title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2"
                placeholder="Demo URL (optional)"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2 md:col-span-2"
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2 md:col-span-1"
                type="file"
                onChange={(e) => setReportFile(e.target.files?.[0] || null)}
              />
              <button
                className="rounded-xl bg-gray-900 text-white px-3 py-2 md:col-span-1"
                onClick={submitProject}
              >
                Upload
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Submitted Projects</div>

          <div className="mt-3 space-y-3">
            {projects.length === 0 ? (
              <div className="text-sm text-gray-600">No projects yet.</div>
            ) : (
              projects.map((p) => {
                const g = gradesByProject[p.id];
                return (
                  <div key={p.id} className="border rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="font-medium text-lg">{p.title}</div>
                        {p.description && (
                          <div className="text-sm text-gray-700 mt-1">{p.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Student: {p.student_id.slice(0, 8)}… • Submitted:{" "}
                          {new Date(p.created_at).toLocaleString()}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.demo_url && (
                            <a
                              className="px-3 py-1.5 rounded-lg border"
                              href={p.demo_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Demo
                            </a>
                          )}
                          {p.report_path && (
                            <button
                              className="px-3 py-1.5 rounded-lg border"
                              onClick={() => openSigned(p.report_path)}
                            >
                              View Report
                            </button>
                          )}
                        </div>

                        {g && (
                          <div className="mt-3 bg-gray-50 border rounded-xl p-3">
                            <div className="text-sm font-semibold">
                              Grade: {g.marks}
                            </div>
                            {g.feedback && (
                              <div className="text-sm text-gray-700 mt-1">
                                Feedback: {g.feedback}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              Graded: {new Date(g.graded_at).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {isTeacher && (
                        <div className="w-full md:w-80 bg-white border rounded-2xl p-3">
                          <div className="font-semibold text-sm">Assess</div>
                          <div className="mt-2 space-y-2">
                            <input
                              className="w-full border rounded-xl px-3 py-2"
                              placeholder="Marks"
                              type="number"
                              value={marksById[p.id] ?? ""}
                              onChange={(e) =>
                                setMarksById((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                            />
                            <textarea
                              className="w-full border rounded-xl px-3 py-2"
                              placeholder="Feedback (optional)"
                              rows={3}
                              value={fbById[p.id] ?? ""}
                              onChange={(e) =>
                                setFbById((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="w-full rounded-xl bg-gray-900 text-white px-3 py-2"
                              onClick={() => saveGrade(p.id)}
                            >
                              Save Grade
                            </button>
                          </div>

                          <button
                            className="mt-3 w-full px-3 py-2 rounded-xl border text-red-600"
                            onClick={async () => {
                              // teacher can delete project if needed
                              await supabase.from("projects").delete().eq("id", p.id);
                              // optional: remove report file
                              if (p.report_path) {
                                await supabase.storage.from(bucket).remove([p.report_path]);
                              }
                              await load();
                            }}
                          >
                            Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}