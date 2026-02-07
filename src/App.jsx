import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

// ✅ shadcn/sonner toaster
import { Toaster } from "@/components/ui/sonner";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Notes from "./pages/Notes";
import Homework from "./pages/Homework";
import Assignments from "./pages/Assignments";
import Videos from "./pages/Videos";
import Projects from "./pages/Projects";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* ✅ Toast notifications will work from any page */}
      <Toaster richColors position="top-right" />

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={session ? <Dashboard /> : <Navigate to="/login" />}
        />

        <Route
          path="/notes/:moduleId"
          element={session ? <Notes /> : <Navigate to="/login" />}
        />
        <Route
          path="/homework/:moduleId"
          element={session ? <Homework /> : <Navigate to="/login" />}
        />
        <Route
          path="/assignments/:moduleId"
          element={session ? <Assignments /> : <Navigate to="/login" />}
        />
        <Route
          path="/videos/:moduleId"
          element={session ? <Videos /> : <Navigate to="/login" />}
        />
        <Route
          path="/projects/:moduleId"
          element={session ? <Projects /> : <Navigate to="/login" />}
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
