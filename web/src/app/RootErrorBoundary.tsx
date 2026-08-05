import { AlertTriangle, Phone } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

/**
 * Deliberately does NOT depend on the i18n or theme providers — if one of those
 * is what failed, the boundary still has to render. Copy is bilingual inline
 * and the emergency number is a plain tel: link that works with no JS state.
 */
export function RootErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-critical-soft text-critical">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-2xl font-bold text-foreground text-balance">
        {notFound ? "Page not found" : "This page didn't load"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground text-pretty">
        {notFound
          ? "That link does not point anywhere."
          : "Something went wrong on our side. You can still call for help below."}
      </p>
      <p lang="ml" className="max-w-md text-sm text-muted-foreground text-pretty">
        {notFound ? "ആ ലിങ്ക് എവിടേക്കും പോകുന്നില്ല." : "എന്തോ പിഴവ് സംഭവിച്ചു."}
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-surface px-5 text-sm font-semibold text-foreground"
        >
          Go to camp list
        </Link>
        <a
          href="tel:1077"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger-call px-5 text-sm font-bold text-danger-call-foreground"
        >
          <Phone className="size-4" aria-hidden="true" />
          Call 1077
        </a>
      </div>
    </div>
  );
}
