import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getUserAndRole } from "@/lib/profile";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");

  useEffect(() => {
    (async () => {
      const r = await getUserAndRole();
      setUser(r.user);
      setRole(r.role);
    })();
  }, []);

  return (
    <AppShell
      title="Dashboard"
      subtitle={user ? `Logged in as ${user.email} • ${role}` : ""}
      userEmail={user?.email}
      role={role}
      right={
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={async () => {
            await supabase.auth.signOut();
            nav("/login");
          }}
        >
          Logout
        </Button>
      }
    >
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Welcome</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>Teacher can create Homework/Assignments and grade/verify submissions.</div>
          <div>Students can submit Homework/Assignments/Projects and view grades & verification.</div>
        </CardContent>
      </Card>
    </AppShell>
  );
}