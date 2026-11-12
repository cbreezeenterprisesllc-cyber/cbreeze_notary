/// <reference types="vite/client" />

// Allow importing SQL as a raw string (`import schema from "./schema.sql?raw"`),
// which Vite inlines at build time.
declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*.sql" {
  const content: string;
  export default content;
}
