import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ensureProfile } from "../lib/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup
  const [role, setRole] = useState("student"); // for signup
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
        });
        if (error) throw error;

        // After signup, user may need email confirmation depending on settings.
        // For student project, usually email confirmation is off OR you can test with same session.
        // Try create profile (if session exists)
        await ensureProfile({ full_name: fullName, role });

        setMsg("Signup successful. If login doesn’t work, confirm email (Supabase Auth settings).");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) throw error;
        navigate("/");
      }
    } catch (err) {
      setMsg(err.message || "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6">
        <div className="text-2xl font-semibold">Faculty Portal</div>
        <div className="text-sm text-gray-600 mt-1">
          {mode === "login" ? "Login" : "Create account"}
        </div>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          {mode === "signup" && (
            <>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`flex-1 px-3 py-2 rounded-xl border ${
                    role === "student" ? "bg-gray-900 text-white" : "bg-white"
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`flex-1 px-3 py-2 rounded-xl border ${
                    role === "teacher" ? "bg-gray-900 text-white" : "bg-white"
                  }`}
                >
                  Teacher
                </button>
              </div>
            </>
          )}

          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            type="password"
            required
          />

          <button className="w-full px-3 py-2 rounded-xl bg-gray-900 text-white">
            {mode === "login" ? "Login" : "Sign up"}
          </button>
        </form>

        {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}

        <div className="mt-4 text-sm text-gray-700">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button className="underline" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="underline" onClick={() => setMode("login")}>
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}