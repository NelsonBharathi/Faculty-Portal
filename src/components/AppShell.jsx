import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

const NAV = [
  { label: "Dashboard", path: "/" },
  { label: "Notes", path: "/notes" },
  { label: "Homework", path: "/homework" },
  { label: "Assignments", path: "/assignments" },
  { label: "Projects", path: "/projects" },
  { label: "Videos", path: "/videos" }
];

export default function AppShell({ userEmail, role, title, subtitle, right, children }) {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="font-semibold">
                {(title?.[0] || "F").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <div className="text-base font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">
                {subtitle || (userEmail ? `${userEmail} • ${role || ""}` : "")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">{right}</div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3">
          <Card className="border bg-background">
            <CardContent className="flex flex-wrap gap-2 p-2">
              {NAV.map((x) => {
                const active = loc.pathname === x.path;
                return (
                  <Button
                    key={x.path}
                    variant={active ? "default" : "secondary"}
                    className="rounded-xl"
                    onClick={() => nav(x.path)}
                  >
                    {x.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}