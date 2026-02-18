import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Not Found</h1>
      <Link className="text-sm text-zinc-300 underline" to="/transcribe">
        Go to Transcribe
      </Link>
    </div>
  );
}
