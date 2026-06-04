/// <reference types="vite/client" />

// Fontsource packages ship CSS as their entrypoint; declare them so
// side-effect imports type-check under TypeScript's bundler resolution.
declare module "@fontsource-variable/inter";
