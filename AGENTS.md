# Agent Notes

## Commands

- Use `pnpm`; CI uses Node `24.x` with pnpm cache.
- `pnpm dev` runs `pnpm i --silent && vite`; Vite serves on port `8080` (`host: "::"`).
- `pnpm build` installs deps, runs `vite build -l error`, then copies `dist/index.html` to `dist/404.html` for SPA/GitHub Pages routing.
- `pnpm test` is the full local/CI gate: install, `tsc --noEmit`, `eslint`, `vitest run --reporter=dot --silent`, production build, and `dist/404.html` copy.
- Focused checks: `pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm exec vitest run`, `pnpm exec vitest run src/path/file.test.tsx`.
- `pnpm format` runs Prettier across the repo.

## App Wiring

- `src/main.tsx` wraps `<App />` in `ErrorBoundary` and imports `src/index.css` plus Inter variable font.
- `src/App.tsx` is provider wiring only; change it mainly when adding/removing global providers. Current providers are Unhead, Applesauce `EventStoreProvider`, `AccountsProvider`, `ActionsProvider`, tooltip, toaster, and `Suspense`.
- Add routes in `src/AppRouter.tsx` above the catch-all `*`; root NIP-19 identifiers are handled by `/:nip19`, so avoid adding broad dynamic routes above it unless intentional.
- `@/*` is the only configured source alias (`tsconfig.json`, `vite.config.ts`, `components.json`). Prefer it for internal imports.

## Nostr And Applesauce

- For Applesauce or Nostr API questions, use the repo-configured MCPs in `opencode.json`; prefer Applesauce docs/tools over guessing package APIs.
- Core Nostr state lives in `src/services/nostr.ts`: one global `EventStore`, one `RelayPool`, event verification via `nostr-tools`, nostrdb cache persistence, and loaders for events, addresses, reactions, and zaps.
- Publishing should usually go through `publish()` in `src/services/nostr.ts`; it adds the signed event to the local store before publishing to relays.
- Account state is the global `accounts` manager in `src/services/accounts.ts`; it registers common account types and persists account metadata/active account to `localStorage`.
- Actions use `runner` from `src/services/actions.ts`, backed by `accounts.signer` for the currently active account.
- Put custom event factories in `src/factories/` and custom Applesauce factory operations in `src/operations/`; Applesauce v6 removed the legacy `applesauce-factory` blueprint APIs.

## Tests And Lint Gotchas

- Vitest is configured in `vite.config.ts` with `jsdom`, globals, `src/test/setup.ts`, and suppressed React Router future-flag console noise.
- `src/test/setup.ts` mocks `matchMedia`, `scrollTo`, `IntersectionObserver`, and `ResizeObserver`; do not duplicate these mocks in each test unless a test needs custom behavior.
- ESLint has custom repo rules: no placeholder comments matching the local rule, no `fixme` warning comments, no unused disable directives, and no inline scripts in HTML.
- TypeScript is not fully strict (`strict: false`, `noImplicitAny: false`), but `strictNullChecks` is enabled and ESLint enforces unused vars unless prefixed with `_`.

## UI And Styling

- shadcn/ui is configured through `components.json` with CSS variables, Slate base color, aliases under `@/components`, `@/components/ui`, `@/lib`, and `@/hooks`.
- Tailwind dark mode is class-based; theme tokens live in CSS variables consumed by `tailwind.config.ts`.
- Use `cn()` from `@/lib/utils` when combining Tailwind classes.

## CI And Deploy

- Test workflow runs on pushes/PRs to `master` and only executes `pnpm test` after install.
- GitHub Pages deploy workflow runs on pushes to `main` and manually; it builds `dist` and uploads it as the Pages artifact.
