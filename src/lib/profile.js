import { supabase } from "@/lib/supabase";

export async function getUserAndRole() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  if (!user) return { user: null, role: "" };

  // Ensure a profile exists (default = student)
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!prof || error) {
    await supabase.from("profiles").upsert({
      id: user.id,
      role: "student",
      full_name: user.email
    });
    return { user, role: "student" };
  }

  return { user, role: prof.role || "student" };
}