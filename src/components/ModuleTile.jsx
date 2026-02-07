import { Link } from "react-router-dom";

export default function ModuleTile({ icon, title, to }) {
  return (
    <Link
      to={to}
      className="p-4 rounded-2xl bg-white shadow-sm border hover:shadow-md transition"
    >
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gray-100">{icon}</div>
        <div className="font-medium">{title}</div>
      </div>
    </Link>
  );
}