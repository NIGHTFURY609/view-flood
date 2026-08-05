import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { Providers } from "@/app/providers";
import { router } from "@/router";

import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);

// Fade out the pre-JS splash once the app has mounted and painted. Double rAF
// guarantees at least one paint happened, so the app never flashes behind a
// splash that lingers. The 300ms timeout covers the reduced-motion case where
// the transition is disabled and transitionend never fires.
const splash = document.getElementById("splash");
if (splash) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add("splash--hide");
      splash.addEventListener("transitionend", () => splash.remove(), { once: true });
      window.setTimeout(() => splash.remove(), 300);
    });
  });
}
