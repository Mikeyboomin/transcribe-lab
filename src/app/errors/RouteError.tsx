import { isRouteErrorResponse, useRouteError, Link } from "react-router-dom";

export function RouteError() {
  const err = useRouteError();

  let message = "Something went wrong.";
  if (isRouteErrorResponse(err)) message = `${err.status} ${err.statusText}`;
  else if (err instanceof Error) message = err.message;

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Error</h1>
      <p className="text-sm text-zinc-300">{message}</p>
      <Link className="text-sm text-zinc-300 underline" to="/transcribe">
        Go to Transcribe
      </Link>
    </div>
  );
}
