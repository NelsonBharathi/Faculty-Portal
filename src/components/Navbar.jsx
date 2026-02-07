import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Navbar({ title, profile }) {
  const navigate = useNavigate();

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-lg">{title}</div>
        <div className="flex items-center gap-3">
          {profile && (
            <div className="text-sm text-gray-600">
              {profile.full_name || "User"} • {profile.role}
            </div>
          )}
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}