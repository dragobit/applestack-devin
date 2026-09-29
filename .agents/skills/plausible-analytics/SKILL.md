---
name: plausible-analytics
description: Add Plausible Analytics tracking to the application, configured through settings services and environment variables.
---

# Plausible Analytics

Add privacy-friendly analytics with [Plausible](https://plausible.io/) using the `@plausible-analytics/tracker` npm package. Configuration lives in `src/services/settings.ts` as persisted RxJS `BehaviorSubject`s, so it can be set via `VITE_` environment variables and read reactively.

## 1. Install the package

```bash
npm install @plausible-analytics/tracker
```

## 2. Add settings subjects in `src/services/settings.ts`

App configuration in this repo is not a React context — each setting is an exported `BehaviorSubject` persisted to `localStorage` with the `persist()` helper. Add two:

```ts
/** Plausible Analytics domain (empty string = disabled). */
export const plausibleDomain = new BehaviorSubject<string>(
  import.meta.env.VITE_PLAUSIBLE_DOMAIN || "",
);

persist(plausibleDomain, "plausibleDomain", {
  serialize: (v) => v,
  deserialize: (v) => v,
});

/** Plausible Analytics API endpoint (empty string = use default). */
export const plausibleEndpoint = new BehaviorSubject<string>(
  import.meta.env.VITE_PLAUSIBLE_ENDPOINT || "",
);

persist(plausibleEndpoint, "plausibleEndpoint", {
  serialize: (v) => v,
  deserialize: (v) => v,
});
```

`import.meta.env.VITE_*` provides the build-time default; anything the user writes into localStorage afterward wins (that's how `extraRelays` and `lookupRelays` already behave).

## 3. Create `PlausibleProvider`

Create `src/components/PlausibleProvider.tsx`:

```tsx
import { ReactNode, useEffect, useRef } from "react";
import { use$ } from "@/hooks/use$";
import { plausibleDomain, plausibleEndpoint } from "@/services/settings";

interface PlausibleProviderProps {
  children: ReactNode;
}

/**
 * Reactively initializes Plausible Analytics from settings.
 * Plausible's `init()` can only be called once, so we guard with a ref.
 */
export function PlausibleProvider({ children }: PlausibleProviderProps) {
  const domain = use$(plausibleDomain);
  const endpoint = use$(plausibleEndpoint);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !domain) return;
    initializedRef.current = true;

    import("@plausible-analytics/tracker")
      .then(({ init }) => {
        init({
          domain,
          ...(endpoint && { endpoint }),
        });
      })
      .catch(console.error);
  }, [domain, endpoint]);

  return <>{children}</>;
}
```

`use$` (re-exported from `applesauce-react/hooks`) subscribes to the subject and re-renders on change.

## 4. Wire into `src/App.tsx`

Import `PlausibleProvider` and render it inside the provider tree — anywhere inside `TooltipProvider` works since it only reads services:

```tsx
import { PlausibleProvider } from "@/components/PlausibleProvider";

// In the JSX:
<TooltipProvider>
  <PlausibleProvider>{/* ...rest of the tree... */}</PlausibleProvider>
</TooltipProvider>;
```

## 5. Configure via environment variables

Create or update `.env`:

```
VITE_PLAUSIBLE_DOMAIN="example.com"
VITE_PLAUSIBLE_ENDPOINT="https://plausible.example.com/api/event"
```

`VITE_PLAUSIBLE_ENDPOINT` is optional — it defaults to Plausible Cloud's endpoint if omitted. Set it when using a self-hosted Plausible instance.

To let users change the domain at runtime, expose a settings control that calls `plausibleDomain.next(newDomain)` — the subject persists automatically and `PlausibleProvider` reacts.
