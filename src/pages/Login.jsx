import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) return toast.error("Email and password required.");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Signup done. Check email if confirmation is enabled, then login.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Logged in");
        nav("/");
      }
    } catch (e) {
      toast.error(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Faculty Portal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Login as Teacher or Student using your Supabase Auth account.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
          </div>

          <div className="grid gap-2">
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </div>

          <Button className="rounded-xl" onClick={submit} disabled={loading}>
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Login"}
          </Button>

          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            disabled={loading}
          >
            {mode === "signin" ? "New user? Sign up" : "Already have account? Sign in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}