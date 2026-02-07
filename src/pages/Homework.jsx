import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { uploadToBucket } from "./_fileHelpers";

export default function Homework() {
  const { moduleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [module, setModule] = useState(null);

  const [homeworks, setHomeworks] = useState([]);
  const [submissionsByHw, setSubmissionsByHw] = useState({}); // { hwId: [] }

  // teacher create homework
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState(""); // datetime-local string
  const [points, setPoints] = useState(10);

  // student submission
  const [fileByHw, setFileByHw] = useState({}); // { hwId: File }
  const [msg, setMsg] = useState("");

  const bucket = "hw-submissions";

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

    const { data: hws } = await supabase
      .from("homeworks")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false });

    setHomeworks(hws || []);

    // Load submissions per homework
    const map = {};
    for (const hw of hws || []) {
      const { data: subs } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("homework_id", hw.id)
        .order("submitted_at", { ascending: false });

      map[hw.id] = subs || [];
    }
    setSubmissionsByHw(map);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function isLate(hw) {
    const dl = new Date(hw.deadline).getTime();
    return Date.now() > dl;
  }

  async function createHomework() {
    setMsg("");
    try {
      if (!isTeacher) throw new Error("Only teacher can create homework");
      if (!title.trim()) throw new Error("Enter title");
      if (!deadline) throw new Error("Set deadline");

      const dlISO = new Date(deadline).toISOString();

      const { error } = await supabase.from("homeworks").insert([
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
      setMsg("Homework created!");
      await load();
    } catch (e) {
      setMsg(e.message || "Failed");
    }
  }

  async function submit(hw) {
    setMsg("");
    try {
      if (!isStudent) throw new Error("Only students can submit");
      if (isLate(hw)) throw new Error("Deadline passed. Submission closed.");
      const file = fileByHw[hw.id];
      if (!file) throw new Error("Choose a file");

      const up = await uploadToBucket({
        bucket,
        file,
        folderPrefix: `${moduleId}/${hw.id}/${profile.id}`,
      });

      const { error } = await supabase.from("homework_submissions").insert([
        {
          homework_id: hw.id,
          student_id: profile.id,
          file_path: up.path,
        },
      ]);
      if (error) throw error;

      setFileByHw((prev) => ({ ...prev, [hw.id]: null }));
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

  const mySubmissionsCount = useMemo(() => {
    if (!isStudent) return null;
    let c = 0;
    for (const hw of homeworks) {
      const subs = submissionsByHw[hw.id] || [];
      c += subs.filter((s) => s.student_id === profile.id).length;
    }
    return c;
  }, [homeworks, submissionsByHw, isStudent, profile]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={module?.name || "Homework"} profile={profile} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {msg && (
          <div className="bg-white border rounded-2xl p-3 text-sm text-gray-700">
            {msg}
          </div>
        )}

        {isStudent && (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Your submissions</div>
            <div className="text-sm text-gray-600">
              Total submissions made: {mySubmissionsCount ?? 0}
            </div>
          </div>
        )}

        {isTeacher && (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Create Homework</div>
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
                onClick={createHomework}
              >
                Create
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Deadline is based on your device time.
            </div>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold">Homework List</div>

          <div className="mt-3 space-y-3">
            {homeworks.length === 0 ? (
              <div className="text-sm text-gray-600">No homework yet.</div>
            ) : (
              homeworks.map((hw) => {
                const subs = submissionsByHw[hw.id] || [];
                const late = isLate(hw);

                return (
                  <div key={hw.id} className="border rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="font-medium text-lg">{hw.title}</div>
                        {hw.description && (
                          <div className="text-sm text-gray-700 mt-1">
                            {hw.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Deadline: {new Date(hw.deadline).toLocaleString()} •
                          Points: {hw.points} •{" "}
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
                              setFileByHw((prev) => ({
                                ...prev,
                                [hw.id]: e.target.files?.[0] || null,
                              }))
                            }
                            disabled={late}
                          />
                          <button
                            className="rounded-xl bg-gray-900 text-white px-3 py-2"
                            onClick={() => submit(hw)}
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
                            await supabase.from("homeworks").delete().eq("id", hw.id);
                            await load();
                          }}
                        >
                          Delete Homework
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