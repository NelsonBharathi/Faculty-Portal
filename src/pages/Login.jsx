import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup
  const [role, setRole] = useState("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;

        toast.success("Signup successful. Now login.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) throw error;

        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Faculty Portal</CardTitle>
              <Badge variant="secondary">Premium UI</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {mode === "login" ? "Login to continue" : "Create your account"}
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={role === "student" ? "default" : "outline"}
                      onClick={() => setRole("student")}
                    >
                      Student
                    </Button>
                    <Button
                      type="button"
                      variant={role === "teacher" ? "default" : "outline"}
                      onClick={() => setRole("teacher")}
                    >
                      Teacher
                    </Button>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
              </div>

              <Button className="w-full" disabled={busy}>
                {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}