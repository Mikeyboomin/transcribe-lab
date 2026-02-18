import { NavLink } from "react-router-dom";

const linkBase = "rounded px-3 py-2 text-sm transition hover:bg-zinc-800";
const active = "bg-zinc-800";

export function TopNav() {
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center gap-2 p-3">
        <div className="mr-2 font-semibold">Transcribe</div>

        <NavLink
          to="/transcribe"
          className={({ isActive }) => `${linkBase} ${isActive ? active : ""}`}
        >
          Transcribe
        </NavLink>
        <NavLink
          to="/split"
          className={({ isActive }) => `${linkBase} ${isActive ? active : ""}`}
        >
          Split
        </NavLink>
        <NavLink
          to="/compress"
          className={({ isActive }) => `${linkBase} ${isActive ? active : ""}`}
        >
          Compress
        </NavLink>
        <NavLink
          to="/video-to-audio"
          className={({ isActive }) => `${linkBase} ${isActive ? active : ""}`}
        >
          Video → Audio
        </NavLink>
      </div>
    </header>
  );
}
