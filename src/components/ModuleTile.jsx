import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function ModuleTile({ icon, title, to }) {
  return (
    <Link to={to}>
      <Card className="group hover:-translate-y-0.5 hover:shadow-lg transition">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{title}</div>
              <div className="text-sm text-muted-foreground">Open</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}