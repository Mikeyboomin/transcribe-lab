import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Shell } from "./Shell";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <TopNav />
      <Shell>
        <Outlet />
      </Shell>
    </div>
  );
}
