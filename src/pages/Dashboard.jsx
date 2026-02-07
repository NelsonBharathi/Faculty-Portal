import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import ModuleTile from "../components/ModuleTile";
import { getMyProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Video,
  FolderKanban,
  Plus,
} from "lucide-react";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("custom");

  function iconFor(kind) {
    if (kind === "notes") return <BookOpen size={20} />;
    if (kind === "homework") return <ClipboardList size={20} />;
    if (kind === "assignment") return <FileText size={20} />;
    if (kind === "videos") return <Video size={20} />;
    if (kind === "projects") return <FolderKanban size={20} />;
    return <FolderKanban size={20} />;
  }

  function routeFor(m) {
    if (m.kind === "notes" || m.kind === "custom") return `/notes/${m.id}`;
    if (m.kind === "homework") return `/homework/${m.id}`;
    if (m.kind === "assignment") return `/assignments/${m.id}`;
    if (m.kind === "videos") return `/videos/${m.id}`;
    if (m.kind === "projects") return `/projects/${m.id}`;
    return `/notes/${m.id}`;
  }

  async function load() {
    setLoading(true);

    try {
      // 1️⃣ Load profile
      const p = await getMyProfile();
      setProfile(p);

      if (!p) {
        setModules([]);
        setLoading(false);
        return;
      }

      // 2️⃣ Load modules
      const { data: mods, error } = await supabase
        .from("modules")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // 3️⃣ If teacher & no modules → seed ONCE
      if (p.role === "teacher" && (mods?.length || 0) === 0) {
        const standard = [
          { name: "Notes", kind: "notes" },
          { name: "Homework", kind: "homework" },
          { name: "Assignments", kind: "assignment" },
          { name: "Videos", kind: "videos" },
          { name: "Projects", kind: "projects" },
        ];

        await supabase.from("modules").insert(
          standard.map((s) => ({
            ...s,
            created_by: p.id,
          }))
        );

        const { data: seeded } = await supabase
          .from("modules")
          .select("*")
          .order("created_at", { ascending: true });

        setModules(seeded || []);
      } else {
        setModules(mods || []);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }

  // 🔒 RUN ONLY ONCE (no dependency loop)
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Dashboard" profile={profile} />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : !profile ? (
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Profile not found</div>
            <div className="text-sm text-gray-600 mt-1">
              Your user exists in Authentication but not in the profiles table.
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((m) => (
                <ModuleTile
                  key={m.id}
                  icon={iconFor(m.kind)}
                  title={m.name}
                  to={routeFor(m)}
                />
              ))}

              {profile.role === "teacher" && (
                <button
                  className="p-4 rounded-2xl bg-white shadow-sm border hover:shadow-md transition text-left"
                  onClick={() => setShowAdd(true)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gray-100">
                      <Plus size={20} />
                    </div>
                    <div className="font-medium">Add Module</div>
                  </div>
                </button>
              )}
            </div>

            {showAdd && profile.role === "teacher" && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4">
                <div className="w-full max-w-md bg-white rounded-2xl p-5">
                  <div className="font-semibold text-lg">Create new module</div>

                  <div className="mt-3 space-y-2">
                    <input
                      className="w-full border rounded-xl px-3 py-2"
                      placeholder="Module name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <select
                      className="w-full border rounded-xl px-3 py-2"
                      value={newKind}
                      onChange={(e) => setNewKind(e.target.value)}
                    >
                      <option value="custom">Custom (File board)</option>
                      <option value="notes">Notes</option>
                      <option value="videos">Videos</option>
                    </select>
                  </div>

                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      className="px-3 py-2 rounded-xl border"
                      onClick={() => setShowAdd(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white"
                      onClick={async () => {
                        if (!newName.trim()) return;
                        await supabase.from("modules").insert([
                          {
                            name: newName.trim(),
                            kind: newKind,
                            created_by: profile.id,
                          },
                        ]);
                        setShowAdd(false);
                        setNewName("");
                        setNewKind("custom");
                        load();
                      }}
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}