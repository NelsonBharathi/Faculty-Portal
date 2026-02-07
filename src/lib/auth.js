import { supabase } from "./supabase";

export async function getMyProfile() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data;
}

export async function ensureProfile({ full_name, role }) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error("Not logged in");

  // Try fetch
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (existing) return existing;

  // Insert new
  const { data, error } = await supabase
    .from("profiles")
    .insert([{ id: user.id, full_name, role }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}