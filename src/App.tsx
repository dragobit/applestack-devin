// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { createHead, UnheadProvider } from "@unhead/react/client";
import { InferSeoMetaPlugin } from "unhead/plugins";
import { Suspense, useEffect } from "react";
import {
  EventStoreProvider,
  AccountsProvider,
  ActionsProvider,
} from "applesauce-react/providers";
import { eventStore } from "@/services/nostr";
import { accounts } from "@/services/accounts";
import { runner } from "@/services/actions";
import { theme } from "@/services/settings";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppRouter from "./AppRouter";

const head = createHead({
  plugins: [InferSeoMetaPlugin()],
});

/** Toggles the `dark` class on <html> from the persisted `theme` setting. */
function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const value = theme.getValue();
      document.documentElement.classList.toggle(
        "dark",
        value === "dark" || (value === "system" && media.matches),
      );
    };
    const sub = theme.subscribe(apply);
    media.addEventListener("change", apply);
    return () => {
      sub.unsubscribe();
      media.removeEventListener("change", apply);
    };
  }, []);
  return null;
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <EventStoreProvider eventStore={eventStore}>
        <AccountsProvider manager={accounts}>
          <ActionsProvider runner={runner}>
            <TooltipProvider>
              <ThemeSync />
              <Toaster />
              <Suspense>
                <AppRouter />
              </Suspense>
            </TooltipProvider>
          </ActionsProvider>
        </AccountsProvider>
      </EventStoreProvider>
    </UnheadProvider>
  );
}

export default App;
