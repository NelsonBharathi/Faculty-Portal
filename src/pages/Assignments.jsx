import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadToBucket } from "./_fileHelpers";

export default function Assignments() {
  const { moduleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [module, setModule] = useState(null);

  const [items, setItems] = useState([]);
  const [subsById, setSubsById] = useState({});

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [points, setPoints] = useState(10);

  const [fileByItem, setFileByItem] = useState({});
  const [msg, setMsg] = useState("");

  const bucket = "as-submissions";
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

    const { data: asg } = await supabase
      .from("assignments")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });

    setItems(asg || []);

    const map = {};
    for (const a of asg || []) {
      const { data: subs } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", a.id)
        .order("submitted_at", { ascending: false });
      map[a.id] = subs || [];
    }
    setSubsById(map);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function isLate(a) {
    return Date.now() > new Date(a.deadline).getTime();
  }

  async function createAssignment() {
    setMsg("");
    try {
      if (!isTeacher) throw new Error("Only teacher can create assignment");
      if (!title.trim()) throw new Error("Enter title");
      if (!deadline) throw new Error("Set deadline");

      const dlISO = new Date(deadline).toISOString();

      const { error } = await supabase.from("assignments").insert([
        {
          module_id: moduleId,
          title: title.trim(),
          description: desc.trim() || null,
          deadline: dlISO,
          points: Number(points) || 0,
          created_by: profile.id,
        },
      ]);
      if (error) throw error;

      setTitle("");
      setDesc("");
      setDeadline("");
      setPoints(10);
      setMsg("Assignment created!");
      await load();
    } catch (e) {
      setMsg(e.message || "Failed");
    }
  }

  async function submit(a) {
    setMsg("");
    try {
      if (!isStudent) throw new Error("Only students can submit");
      if (isLate(a)) throw new Error("Deadline passed. Submission closed.");
      const file = fileByItem[a.id];
      if (!file) throw new Error("Choose a file");

      const up = await uploadToBucket({
        bucket,
        file,
        folderPrefix: `${moduleId}/${a.id}/${profile.id}`,
      });

      const { error } = await supabase.from("assignment_submissions").insert([
        {
          assignment_id: a.id,
          student_id: profile.id,
          file_path: up.path,
        },
      ]);
      if (error) throw error;

      setFileByItem((prev) => ({ ...prev, [a.id]: null }));
      setMsg("Submitted!");
      await load();
    } catch (e) {
      setMsg(e.message || "Submit failed");
    }
  }

  async function openSigned(path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={module?.name || "Assignments"} profile={profile} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {msg && (
          <div className="bg-white border rounded-2xl p-3 text-sm text-gray-700">
            {msg}
          </div>
        )}

        {isTeacher && (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Create Assignment</div>
            <div className="mt-3 grid md:grid-cols-2 gap-2">
              <input
                className="border rounded-xl px-3 py-2"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2"
                placeholder="Points"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2 md:col-span-2"
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <input
                className="border rounded-xl px-3 py-2"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <button
                className="rounded-xl bg-gray-900 text-white px-3 py-2"
                onClick={createAssignment}
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Assignments List</div>

          <div className="mt-3 space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-gray-600">No assignments yet.</div>
            ) : (
              items.map((a) => {
                const subs = subsById[a.id] || [];
                const late = isLate(a);

                return (
                  <div key={a.id} className="border rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="font-medium text-lg">{a.title}</div>
                        {a.description && (
                          <div className="text-sm text-gray-700 mt-1">
                            {a.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Deadline: {new Date(a.deadline).toLocaleString()} •
                          Points: {a.points} •{" "}
                          <span className={late ? "text-red-600" : "text-green-600"}>
                            {late ? "Closed" : "Open"}
                          </span>
                        </div>
                      </div>

                      {isStudent && (
                        <div className="flex flex-col gap-2">
                          <input
                            className="border rounded-xl px-3 py-2"
                            type="file"
                            onChange={(e) =>
                              setFileByItem((prev) => ({
                                ...prev,
                                [a.id]: e.target.files?.[0] || null,
                              }))
                            }
                            disabled={late}
                          />
                          <button
                            className="rounded-xl bg-gray-900 text-white px-3 py-2"
                            onClick={() => submit(a)}
                            disabled={late}
                          >
                            Submit
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-semibold">
                        Submissions ({subs.length})
                      </div>

                      {subs.length === 0 ? (
                        <div className="text-sm text-gray-600 mt-1">
                          No submissions yet.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {subs.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between border rounded-xl p-3"
                            >
                              <div className="text-sm">
                                <div className="font-medium">
                                  Student: {s.student_id.slice(0, 8)}…
                                </div>
                                <div className="text-xs text-gray-500">
                                  Submitted: {new Date(s.submitted_at).toLocaleString()}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                {(isTeacher || (isStudent && s.student_id === profile?.id)) && (
                                  <button
                                    className="px-3 py-1.5 rounded-lg border"
                                    onClick={() => openSigned(s.file_path)}
                                  >
                                    View / Download
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isTeacher && (
                      <div className="mt-3 flex justify-end">
                        <button
                          className="px-3 py-1.5 rounded-lg border text-red-600"
                          onClick={async () => {
                            await supabase.from("assignments").delete().eq("id", a.id);
                            await load();
                          }}
                        >
                          Delete Assignment
                        </button>
                      </div>
                    )}
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