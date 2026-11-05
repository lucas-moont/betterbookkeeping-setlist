# Where to put query keys, `queryOptions` and `mutationOptions` (2026)

Research note, written 2026-11-05. Scope: where Setlist should keep TanStack Query v5 key factories, `queryOptions` and `mutationOptions` in a TanStack Start app with file-based routing. The three candidates are (a) per-domain files in `src/queries/`, (b) per-route `-queries/` folders (the current convention), and (c) a `queries.ts` next to the server-side domain module in `src/lib/<domain>/`. Hierarchical key factories and automatic invalidation through `mutation.meta.invalidates` are already decided and are not discussed here. Bracketed numbers point to [Sources](#6-sources). Text marked **(analysis)** is my own reasoning, not a sourced claim.

Trust levels: TkDodo's blog (he maintains TanStack Query) and tanstack.com docs and the official examples in `TanStack/router` are **high**. Anything else is marked **lower-trust**. Quotes are kept short (about 125 characters at most). Longer passages are labelled as paraphrase.

## 1. TL;DR

- **No primary source documents a `src/queries/` folder or a `-queries/` folder.** The official Start examples put the server function *and* its `queryOptions` in one domain module, `src/utils/posts.tsx`, which several routes import [21][25]. TkDodo's tree is `features/<Feature>/queries.ts`, one per feature [1], and in 2026 he argues for grouping code by domain ("verticals"), not by technical type [6].
- **What everyone agrees on:** define `queryKey` and `queryFn` together, once, as exported `queryOptions` functions, and reuse them in loaders and components [3][5][9][16]. Use one key factory per feature [1]. Option (b) breaks this as soon as two routes need the same data, and that is already happening here (`movementsQueryOptions` is duplicated).
- **Recommendation (analysis): option (a) now.** Create `src/queries/{workouts,movements,body-weight,progression}.ts`, one file per key-factory root, each holding the keys, the `queryOptions` and the `mutationOptions` (with `meta.invalidates`). It removes the duplication, gives body-weight's three screens one import, and leaves `src/lib` untouched.
- **(c) is the more "official-looking" shape, but it costs more.** It only becomes nearly free if `src/lib` is reorganised anyway, for example to follow Start's `*.functions.ts` / `*.server.ts` split [22]. Treat (a) as the cheap step and (c) as a possible later move. Don't treat either as the one documented best practice.
- **Version caveat:** the current Router, Start and Query docs replace `ensureQueryData` with `queryClient.query(...)` [14][16][21]. That method does not exist in the installed `@tanstack/query-core` 5.90.18, where `ensureQueryData` is not deprecated **(analysis, from the installed `.d.ts`)**. Keep `ensureQueryData` for now.

## 2. What TkDodo recommends

His position has changed over time. Present-day advice is the 2024–2026 material, not the 2021 post read on its own.

| Post | Date | What it says about placement |
|---|---|---|
| "Effective React Query Keys" [1] | 2021-06-13, updated 2022-04-23 | Against a global keys file: "I don't believe that storing all your Query Keys globally in `/src/utils/queryKeys.ts` will make things better." For colocation: "I keep my Query Keys next to their respective queries, co-located in a feature directory". "The queries file will contain everything React Query related." "I recommend one Query Key factory per feature." At the time he exported only custom hooks, so "the actual Query Functions as well as Query Keys will stay local" (2021 advice, superseded below). |
| "Leveraging the Query Function Context" [2] | 2021-10-26, updated 2023-01-03 | Recommends object-shaped keys from a key factory. **Nothing on placement.** |
| "The Query Options API" [3] | 2024-01-17 | "Separating QueryKey from QueryFunction was a mistake." He asks "why define keys in one central place while having the functions far a way from them in our custom hooks?" His factory example (`todoQueries`) mixes key-only entries "that we can use to build a hierarchy and for query invalidation" with full `queryOptions` entries. Custom hooks "won't be my first choice for abstractions." **No file or folder is named.** |
| "Automatic Query Invalidation after Mutations" [4] | 2024-05-25, updated 2025-11-25 | Global `MutationCache` callbacks are "invoked for _every_ Mutation". "We can use `meta` to store arbitrary, static information about a Mutation", for example `invalidates: [['issues'], ['labels']]`. The cache is created with the `QueryClient`. **No file is named** for the mutation definitions. |
| "Creating Query Abstractions" [5] | 2026-02-23 | "Since v5, my preferred way to create Query abstractions is not with custom hooks anymore but with `queryOptions`." "It's just a regular function, so it works anywhere." Per-screen tweaks such as `select` or `throwOnError` are spread on top "directly at the usage sites". **Nothing on placement, key factories or `mutationOptions`.** |
| "The Vertical Codebase" [6] | 2026-04-13 | Criticises the horizontal (by type) split: "It groups by type, not by domain." "Code that changes together should live together." His example asks "Where does widgetQueryOptions live?" and rejects `src/utils/widget.ts` as the horizontal answer. "Logical groups are often coupled to routes or pages, so that's a good start." Paraphrase: code shared across verticals becomes its own vertical. |
| "TanStack Router and Query" [7] | 2026-05-26 | The loader "merely triggers the Query so that it can start fetching early"; `useSuspenseQuery` for blocking data and `useQuery` for deferred data. **Does not show where `queryOptions` live.** |
| "Reliable Query Prefetching with TanStack Router" [8] | 2026-08-18 | "let's just put the options into Route Context and consume them in both places". "because context inherits from parents, sub-routes will know about those `queryOptions`, too." This is a sharing mechanism along the route tree, not a file location. |

`mutationOptions`: **not found.** I found no TkDodo post on where `mutationOptions` should live.

**Reading (analysis):** current TkDodo advice is (1) exported `queryOptions` as the main abstraction [3][5], (2) one key factory per feature that also holds the `queryOptions` [1][3], and (3) feature/domain grouping over type grouping [6]. Strictly, a top-level `src/queries/` folder is a type bucket, which [6] argues against. Option (c) is the most vertical of the three. But in Start, routes have to live in `src/routes/`, so a domain will be split across `src/routes`, `src/lib` and wherever queries go under every option.

## 3. What the official TanStack docs and examples do

### Docs

- **Query, `queryOptions` guide [9]:** "One of the best ways to share `queryKey` and `queryFn` between multiple places". "You can define all possible options for a query in one place". No file location is given.
- **Query, Query Keys guide [10]:** for organising keys in larger apps, it links to TkDodo's "Effective React Query Keys" [1] and to the community `lukemorales/query-key-factory` package. Nothing on colocation.
- **Query, `mutationOptions` reference [11]:** a helper that returns "The same options object, unchanged". Its two overloads differ on whether a `mutationKey` is required. No file location is given.
- **Query, `meta` and `MutationCache`:** `useMutation`'s `meta` is "Additional payload to be stored on the mutation cache entry", which "can be read wherever the `mutation` is available" [12]. The "Invalidations from Mutations" guide links to TkDodo's post for automatic invalidation [13]. The `MutationCache` reference page does not document the callbacks [15]. In the installed 5.90.18 types, `MutationCacheConfig.onSuccess` is `(data, variables, onMutateResult, mutation, context)` [15].
- **Router, TanStack Query integration [16]:** `queryOptions` is defined **inline in the route file** (`src/routes/posts.tsx`) and shared between the loader and `useSuspenseQuery`. The loader uses `context.queryClient.query({ ...postsQuery, staleTime: 'static' })`. "Previous versions of this guide used `queryClient.ensureQueryData` and `queryClient.prefetchQuery`." The page gives no structural guidance beyond this.
- **Router, External Data Loading [17]:** the same inline-in-route pattern.
- **Start, TanStack Query guide [21]:** puts the `createServerFn` and its `queryOptions` together in `src/utils/preferences.ts`. The route `src/routes/preferences.tsx` imports `readerNameOptions` for its loader and component. "Privileged reads belong in a server function, because a normal route loader can also run in the browser during navigation." Another Start page adds: "Remember loaders are isomorphic, not server-only" [29].
- **Start, Server Functions guide [22]:** "Server functions can be statically imported in any file, including client components." "The build process replaces server function implementations with RPC stubs in client bundles." For larger apps it suggests:

  ```
  src/utils/
  ├── users.functions.ts   # createServerFn wrappers: "safe to import anywhere"
  ├── users.server.ts      # server-only: "only imported inside server function handlers"
  └── schemas.ts           # client-safe
  ```

- **Start, Execution Model [23]:** `createServerOnlyFn` is "Server-only, client crashes if called". Files named `*.server.*` / `*.client.*` opt into import protection.
- **Start, Import Protection [24]:** "By default, `*.server.*` files are denied in the client environment", but its own Option A example puts a `createServerFn` in `src/users.server.ts`, commented "Safe to import from client code (compiler rewrites the handler)". The doc doesn't reconcile the two. In build mode, checks run after tree-shaking.
- **Router, `-` prefix [18][19][20]:** "Files and folders can be excluded from route generation with a `-` prefix". "This gives you the ability to colocate logic in the route directories." `routeFileIgnorePrefix` defaults to `-`. Every official example of it uses components (`-components/`, `-posts-table.tsx`). **An official `-queries/` example: not found.**
- **Official guidance on route-colocated vs shared data modules: not found.** The one community thread asking this ([28], lower-trust) has no maintainer answer.

### Example file trees (TanStack/router `main`, read 2026-11-05)

`examples/react/start-basic-react-query` [25] (`utils/posts.tsx` last changed 2026-06-06; route imports checked in the raw files):

```
src/
├── router.tsx
├── routes/
│   ├── posts.route.tsx          # imports postsQueryOptions from ../utils/posts
│   ├── posts.$postId.tsx        # imports postQueryOptions from ../utils/posts
│   ├── posts_.$postId.deep.tsx  # imports postQueryOptions from ../utils/posts (2 routes share it)
│   ├── users.route.tsx, users.$userId.tsx, preferences.tsx, ...
└── utils/
    ├── posts.tsx                # createServerFn fetchPosts/fetchPost + postsQueryOptions/postQueryOptions
    ├── users.tsx
    └── preferences.ts           # createServerFn + readerNameOptions
```

The loaders here still use `context.queryClient.ensureQueryData(postsQueryOptions())` and the components use `useSuspenseQuery(postsQueryOptions())` [25], which is exactly this repo's pattern.

`examples/react/basic-react-query-file-based` [26] (Router only, no Start):

```
src/
├── posts.tsx                 # fetchers
├── postsQueryOptions.tsx     # one queryOptions per file, at src root
├── postQueryOptions.tsx
└── routes/posts.route.tsx    # import { postsQueryOptions } from '../postsQueryOptions'
```

`examples/react/kitchen-sink-react-query-file-based` [27]:

```
src/
├── routes/
│   ├── dashboard.invoices.index.tsx  # imports useCreateInvoiceMutation from ../utils/queryOptions
│   └── expensive/-components/Expensive.tsx   # the only "-" folder: components
└── utils/
    ├── mockTodos.ts
    └── queryOptions.ts      # every queryOptions + mutation hooks for the whole app
```

Its mutations import a module-level `queryClient` from `main.tsx` and call blanket `invalidateQueries()` [27]. That won't work with Start's per-request client created in `getRouter()` [21], so it is not a model for this repo **(analysis)**.

**Pattern (analysis):** the examples never put shared `queryOptions` inside a route folder. Inline-in-route appears only in single-use doc snippets [16][17]. As soon as more than one route uses the data, the examples use a shared module outside `src/routes/`, usually one per domain with the server function in the same file [21][25].

## 4. Options compared

| Criterion | (a) `src/queries/<domain>.ts` | (b) `src/routes/<route>/-queries/` + shared keys/mutations | (c) `src/lib/<domain>/queries.ts` |
|---|---|---|---|
| **Locality** | One file per key root holds keys, options and mutations, as TkDodo's "everything React Query related" queries file does [1][3]. It sits away from both the route and the server code. It is a type bucket, which [6] argues against **(analysis)**. | Best route locality for single-use reads. But as (b) is specified, the keys and mutations would go to `src/queries/` (which doesn't exist yet), so one concept is split across two places, which [3] calls a mistake for keys vs. functions **(analysis)**. | Most vertical: the fetcher and its options sit in the same domain folder, which is the official Start example shape [21][25] and in the spirit of [6]. |
| **Duplication** | None. `movements` and `body-weight` each have one definition. | Already duplicated (`movementsQueryOptions` in 2 routes), and body-weight would be read in 3 screens. Workarounds: a cross-route import from another route's `-queries/` (fragile), or TkDodo's parent-route context [8]. The latter only works when the routes share a parent and still doesn't say where the file lives **(analysis)**. | None. |
| **Server/client separation** | Clean. The files are client-bundled and import only `createServerFn` wrappers. Server-only code stays in `src/lib`. | Same as (a). | Client-bundled code sits next to `createServerOnlyFn` and Prisma code. It works if `queries.ts` imports only `createServerFn` wrappers [22]. One wrong import is easy to make, and the installed Start 1.150.0 has no import protection to catch it **(analysis; no import-protection code found in installed `start-plugin-core`)**. |
| **Fit with loaders + `ensureQueryData` + `useSuspenseQuery`** | Same as today: the loader and component import the same `xQueryOptions()` [25]. `meta.invalidates` can use sibling key factories (`import { progressionKeys } from "./progression"`). | Same for reads. `mutationOptions` must live in shared files anyway because of `meta.invalidates`, so (b) is already half of (a). | Same for reads. Cross-domain invalidation imports go between `src/lib/*` folders. |
| **Discoverability** | High. Four files named after the four key roots, so "where is `["body-weight"]`?" has one answer **(analysis)**. | Low for shared data. Which route "owns" `movements`? | Medium-high, if the folder names match the key roots. The proposed `current-workout/` doesn't match the `["workouts", ...]` root **(analysis)**. |
| **Churn for this repo** | Low: move 3 files into 4, update the imports in ~4 routes, delete the `-queries/` folders. `src/lib` is untouched. | None now. It grows with each shared read. | High: `src/lib` is flat today (`workouts.server.ts`, `movements.server.ts`, ...), so it needs to become per-domain folders first. That is only cheap if done together with a `.functions.ts` / `.server.ts` rename [22]. |

All options need the AGENTS.md Architecture line ("Each route keeps its query options in a `-queries/` folder next to it") rewritten. That is a follow-up and is not done in this note.

**Recommendation (analysis):** choose **(a)**. It fixes the concrete problems (duplication, three-screen body-weight, `meta.invalidates` needing importable key factories) for the least churn. It matches TkDodo's current guidance on *content*: one key factory per feature with `queryOptions` in it [1][3][5]. It doesn't match the official examples on *placement*, which keep fetcher and options together per domain [21][25]. Inside each file, follow [3]: key-only entries for invalidation prefixes, and `queryOptions` entries built on top of them. Per-screen `select` is spread at the call site [5], not added as a new export. If `src/lib` is later split into per-domain folders, `src/queries/<domain>.ts` can move into them, which turns (a) into (c) with a mechanical change.

## 5. Risks and open questions

1. **`*.server.ts` naming vs Start import protection.** The repo's `src/lib/workouts.server.ts` exports `createServerFn` and is imported by client query files today. The current Start docs recommend `*.functions.ts` for wrappers that are "safe to import anywhere" and keep `*.server.ts` for code imported only inside handlers [22]. Import protection denies `*.server.*` in the client by default, although its own example contradicts that [24]. This affects options (a), (b) and (c) equally, and may break on a Start upgrade. Decide it separately. It is also what makes (c) cheap or expensive.
2. **`queryClient.query` vs `ensureQueryData`.** The docs have moved to `queryClient.query({ ...opts, staleTime: 'static' })` and mark `ensureQueryData` deprecated [14][16]. The installed `query-core` 5.90.18 has no `query` method and no deprecation on `ensureQueryData` **(analysis, from `node_modules/@tanstack/query-core/build/modern/hydration-BlEVG2Lp.d.ts`)**. When upgrading, the loader call changes under every option. The version that introduced `query`: not found.
3. **Route-context sharing [8] as an alternative for (b).** If the product owner wants to keep (b), parent-route `context` can expose shared `queryOptions` to child routes. Open question: do the `movements` and `body-weight` consumers share a parent route other than `_layout`? If the parent is `_layout`, this amounts to a global registry **(analysis)**.
4. **Type bucket vs vertical.** If the team adopts TkDodo's vertical structure [6] more broadly (components, hooks and queries per domain), `src/queries/` will have to move again. Open question: is per-domain grouping of `src/lib` and `src/components` planned?
5. **Cross-domain imports between query files.** `meta.invalidates` on a workout mutation will reference `progression` and `workouts` keys. Under (a), keep key factories free of side effects so these sibling imports can't create import cycles that matter **(analysis)**.
6. **Unverified:** official guidance on route-colocated vs shared data modules (not found); an official `-queries/` example (not found); TkDodo on `mutationOptions` placement (not found).

## 6. Sources

All accessed 2026-11-05.

1. TkDodo, "Effective React Query Keys" (2021-06-13, updated 2022-04-23): https://tkdodo.eu/blog/effective-react-query-keys
2. TkDodo, "Leveraging the Query Function Context" (2021-10-26, updated 2023-01-03): https://tkdodo.eu/blog/leveraging-the-query-function-context
3. TkDodo, "The Query Options API" (2024-01-17): https://tkdodo.eu/blog/the-query-options-api
4. TkDodo, "Automatic Query Invalidation after Mutations" (2024-05-25, updated 2025-11-25): https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
5. TkDodo, "Creating Query Abstractions" (2026-02-23): https://tkdodo.eu/blog/creating-query-abstractions
6. TkDodo, "The Vertical Codebase" (2026-04-13): https://tkdodo.eu/blog/the-vertical-codebase
7. TkDodo, "TanStack Router and Query" (2026-05-26): https://tkdodo.eu/blog/tan-stack-router-and-query
8. TkDodo, "Reliable Query Prefetching with TanStack Router" (2026-08-18): https://tkdodo.eu/blog/reliable-query-prefetching-with-tanstack-router
9. TanStack Query docs, "Query Options" guide: https://tanstack.com/query/latest/docs/framework/react/guides/query-options
10. TanStack Query docs, "Query Keys" guide: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
11. TanStack Query docs, `mutationOptions` reference: https://tanstack.com/query/latest/docs/framework/react/reference/mutationOptions
12. TanStack Query docs, `useMutation` reference (`meta`, `mutationKey`): https://tanstack.com/query/latest/docs/framework/react/reference/useMutation
13. TanStack Query docs, "Invalidations from Mutations" (v5): https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations
14. TanStack Query docs, `QueryClient` reference (`query`; deprecation of `fetchQuery`, `ensureQueryData`, `prefetchQuery`): https://tanstack.com/query/latest/docs/reference/QueryClient
15. TanStack Query docs, `MutationCache` reference (no callback docs on the page): https://tanstack.com/query/latest/docs/reference/MutationCache. The callback signature is taken from the installed types, `node_modules/@tanstack/query-core/build/modern/hydration-BlEVG2Lp.d.ts` (`interface MutationCacheConfig`, v5.90.18). The `interfaces/MutationCacheConfig` docs page returned 404.
16. TanStack Router docs, "TanStack Query Integration": https://tanstack.com/router/latest/docs/integrations/query
17. TanStack Router docs, "External Data Loading": https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading
18. TanStack Router docs, "Routing Concepts" (excluded files and folders): https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts
19. TanStack Router docs, "File Naming Conventions": https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions
20. TanStack Router docs, "File-Based Routing" API (`routeFileIgnorePrefix`): https://tanstack.com/router/latest/docs/framework/react/api/file-based-routing
21. TanStack Start docs, "TanStack Query" guide: https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query
22. TanStack Start docs, "Server Functions" guide: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
23. TanStack Start docs, "Execution Model": https://tanstack.com/start/latest/docs/framework/react/guide/execution-model
24. TanStack Start docs, "Import Protection": https://tanstack.com/start/latest/docs/framework/react/guide/import-protection
25. TanStack/router example `start-basic-react-query` (file tree via the GitHub API; `src/utils/posts.tsx` and `src/routes/posts.route.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-basic-react-query
26. TanStack/router example `basic-react-query-file-based`: https://github.com/TanStack/router/tree/main/examples/react/basic-react-query-file-based
27. TanStack/router example `kitchen-sink-react-query-file-based` (`src/utils/queryOptions.ts` read raw): https://github.com/TanStack/router/tree/main/examples/react/kitchen-sink-react-query-file-based
28. GitHub Discussion TanStack/router #6182, "How to Structure Start + Query in the best way possible" (2025-12-22; no maintainer answer; **lower-trust**): https://github.com/TanStack/router/discussions/6182
29. TanStack Start docs, "Code Execution Patterns": https://tanstack.com/start/latest/docs/framework/react/guide/code-execution-patterns
