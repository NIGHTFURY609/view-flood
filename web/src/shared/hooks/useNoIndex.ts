import { useEffect } from "react";

/**
 * Marks the current route as noindex,nofollow while it is mounted.
 *
 * The X-Robots-Tag headers in vercel.json are the authoritative signal; this is
 * the fallback for crawlers that execute JS and only read the DOM. It has to be
 * a hook rather than a static tag in index.html because this is a SPA with one
 * HTML shell — a static tag would de-index the landing page too.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
