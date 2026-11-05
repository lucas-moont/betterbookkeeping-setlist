# Code is organized in vertical domain folders

Each domain concept gets one folder under `src/lib/<domain>/` (`workouts`, `movements`, `auth`, `body-weight`, `progression`), and the file names say where each file may run:

- `index.ts` is the deep module: the domain rules, wrapped in `createServerOnlyFn`, taking `(db, userId, ...)`. Server only.
- `<domain>.functions.ts` holds the `createServerFn` adapters (auth middleware, zod validation, module call, error-code translation). TanStack Start's server-function guide calls these files safe to import anywhere.
- `queries.ts` holds the query key factory, `queryOptions`, and `mutationOptions`. Each mutation declares `meta.invalidates` as a fixed list of key prefixes, and one `MutationCache` `onSuccess` in `src/router.tsx` invalidates them.
- `*.server.ts` is kept for code that must never reach the browser and is imported only inside server-function handlers.

This replaces the per-route `-queries/` folders and the `src/lib/*.server.ts` files that held `createServerFn` exports. The evidence is in `docs/research/tanstack-query-organization.md`.

## Considered Options

- **Per-route `-queries/` folders (the previous convention).** It broke as soon as two routes needed the same data: `movementsQueryOptions` was duplicated, and Body Weight Entries will be read by three screens. No official TanStack example uses a `-queries/` folder; the `-` prefix appears only for route-private components.
- **A by-type `src/queries/` folder.** One import per concept and no server code nearby, but it splits each concept across `src/lib` and `src/queries`. That is the by-technical-type layout TkDodo's "The Vertical Codebase" argues against. The official Start example keeps a domain's server function and its `queryOptions` in one module (`src/utils/posts.tsx`).
- **Keep `createServerFn` exports in `*.server.ts`.** Start 1.150 doesn't block these imports, but the current Import Protection guide says `*.server.*` files are denied in the client environment by default. A Start upgrade would break every route that imports one.

## Consequences

One folder per concept from `CONTEXT.md`. Workouts covers both the Current Workout and the history, because both read the same rows and share the `["workouts"]` invalidation root. Route loaders keep `queryClient.ensureQueryData(...)`: the current docs replace it with `queryClient.query(...)`, but `@tanstack/query-core` 5.90.18 doesn't have that method yet. `AGENTS.md` describes this layout, and existing code moves to it in the query refactor issue.
