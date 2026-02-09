import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { supabase } from "@/lib/supabase";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Notes from "@/pages/Notes";
import Homework from "@/pages/Homework";
import Assignments from "@/pages/Assignments";
import Projects from "@/pages/Projects";
import Videos from "@/pages/Videos";

function Protected({ children }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthed(!!data?.user);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!ready) return null;
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/notes"
          element={
            <Protected>
              <Notes />
            </Protected>
          }
        />
        <Route
          path="/homework"
          element={
            <Protected>
              <Homework />
            </Protected>
          }
        />
        <Route
          path="/assignments"
          element={
            <Protected>
              <Assignments />
            </Protected>
          }
        />
        <Route
          path="/projects"
          element={
            <Protected>
              <Projects />
            </Protected>
          }
        />
        <Route
          path="/videos"
          element={
            <Protected>
              <Videos />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
