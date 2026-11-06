# Awaiting invalidation after mutations, and whether auth flows should be mutations (2026)

Research note, written 2026-11-06. Scope: two questions about Setlist's move to automatic invalidation, where each mutation declares `meta: { invalidates: QueryKey[] }` and one `MutationCache` `onSuccess` in `src/router.tsx` invalidates those keys (ADR 0010). Question 1: should that global callback return (await) the `invalidateQueries` promise or fire it without waiting? Question 2: should sign-in, create-account and logout become `useMutation` / `mutationOptions` in `src/lib/auth/queries.ts`, or keep calling the server functions directly? The automatic-invalidation pattern itself is decided and isn't discussed here. Bracketed numbers point to [Sources](#5-sources). Text marked **(analysis)** is my own reasoning, not a sourced claim.

Trust levels: TkDodo's blog (he maintains TanStack Query), the tanstack.com docs (read as the raw Markdown in the `TanStack/query` and `TanStack/router` repos) and the official examples in `TanStack/router` are **high**. Installed `node_modules` source is cited as the ground truth for behaviour. Anything else is marked **lower-trust**. Quotes are kept short (about 125 characters at most). Longer passages are labelled as paraphrase.

Version caveat: the docs and examples are read from `main`, which is newer than the installed packages (`@tanstack/react-start`, `react-router`, `router-core` and `router-ssr-query-core` 1.150.0; `query-core` and `react-query` 5.90.18). For example, the `start-basic-react-query` route now calls `queryClient.query(...)` [22], which isn't in the installed `query-core`. Every behavioural claim below was checked in the installed source [7][8][9][17][18].

## 1. TL;DR

- **Q1: await. Return the invalidation promise from the global `onSuccess` (analysis).** It's the shape of the official Start example [11][22], and the Query docs say returning it keeps `isPending` true until the refetch is done [3]. TkDodo leaves the choice open. His examples fire and forget, and his one argument against awaiting is navigating away as soon as possible [1]. No Setlist mutation navigates afterwards **(analysis)**.
- **Awaiting costs little here.** `invalidateQueries` refetches only _active_ queries by default and just marks the rest stale [1][6][7]. So `history` or `progression` keys invalidated from the current-workout page resolve straight away. Refetch failures are swallowed unless `throwOnError: true` [6][7], so a failed refetch can't reject the mutation or fire the global error toast.
- **Use one `invalidateQueries` call with a `predicate`, as TkDodo does [1], not one call per key.** `cancelRefetch` defaults to `true` [6][7], so two calls that match the same active query would cancel and restart its fetch **(analysis)**. Skip TkDodo's `meta.awaits` hybrid [1] until some mutation needs it.
- **Q2: keep direct server-function calls for sign-in and create-account. Don't add `src/lib/auth/queries.ts` (analysis).** The Start auth guide uses `useServerFn` with local `useState` and `router.invalidate()` [12]. `start-basic-auth` and `start-supabase-basic` use a **hand-rolled** `useMutation` hook in `src/hooks/useMutation.ts`, not TanStack Query's [19][20]. No official Start auth example uses TanStack Query for login. The user lives in router context, not in the Query cache, so `meta.invalidates` would have nothing to invalidate.
- **The current `router.navigate({ to: "/" })` already re-runs the root `beforeLoad`.** "Every preload and navigation still runs its own `beforeLoad` chain" [15], and the installed `loadMatches` calls `beforeLoad` for every match [17]. `router.invalidate()` is the documented call [12], but it's only needed when the URL doesn't change **(analysis)**.
- **Logout: keep `<a href="/logout">` for now.** The full page load throws away the browser QueryClient. The Start guide says to "cancel and remove the previous account's private queries" on sign-out [11]. If logout becomes client-side (the examples use a `/logout` route with `preload: false` and a loader [19][20][23]), add `queryClient.clear()`.

## 2. Question 1: await or fire-and-forget?

### 2.1 What TkDodo says

| Post | Date | What it says about awaiting |
|---|---|---|
| "Automatic Query Invalidation after Mutations" [1] | 2024-05-25, updated 2025-11-25 | "Awaiting an invalidation will result in the Mutation staying in pending state until the refetch has finished." In favour: "a good thing, for example if you'd want your form to stay disabled until then". Against: "not what you want in case you want to navigate from a detail screen to an overview page as soon as possible". On the global callbacks: "just like the usual callbacks, returned Promises will be awaited". His own examples don't await: "we are never awaiting an invalidation, and that's fine if you want your mutations to finish as fast as possible". |
| same [1], "To Await or not to Await" | | Hybrid for the case where you invalidate everything but "have the Mutation stay pending until one important refetch is done": (a) extend `meta`, for example `meta: { invalidates: 'all', awaits: ['labels'] }`; or (b) since "callbacks on the MutationCache run before callbacks on useMutation", keep the global call fire-and-forget and add a local `onSuccess` that returns `invalidateQueries({ queryKey: ['labels'] }, { cancelRefetch: false })`. `cancelRefetch: false` "pick[s] up" the in-flight request so it isn't fetched twice. |
| same [1] | | "Invalidation merely refetches all active Queries that it matches, and marks the rest as stale". His `meta` example uses **one** `invalidateQueries` call with `predicate` and `matchQuery`, and falls back to invalidating everything (`?? true`) when `meta` is missing. |
| "Mastering Mutations in React Query" [2] | 2021-10-09, updated 2023-10-21 | "Promises returned from the mutation callbacks are awaited by React Query". To "stay in loading state while your related queries update, you have to return the result of invalidateQueries from the callback". The code labels the two forms "will wait for query invalidation to finish" and "fire and forget - will not wait". |

**Reading (analysis):** TkDodo doesn't prescribe either form. He presents a trade-off: awaiting keeps forms disabled, fire-and-forget lets you navigate away sooner. Both are fine to him, and the hybrid is for apps that invalidate _everything_ but only care about waiting for one key.

### 2.2 What the official TanStack docs and examples say

- **Query, "Invalidations from Mutations" [3]:** "Returning a Promise on `onSuccess` makes sure the data is updated before the mutation is entirely complete", "(i.e., isPending is true until onSuccess is fulfilled)". Its example `await`s `invalidateQueries`. For automatic invalidation it links to [1].
- **Query, `UseMutationOptions` reference [4]:** for `onSuccess`, "If a promise is returned, it is awaited before `onSettled` runs."
- **Query, `MutationCacheConfig` reference [5]:** "If a callback returns a promise, it will be awaited before the mutation continues." Also: "`defaultOptions` can be overridden by each mutation, while these callbacks are always called". The tanstack.com `MutationCache` class page still documents no callbacks. The generated interface page in the repo does.
- **Query, `QueryClient` reference [6]:** `invalidateQueries` refetches using `refetchType`, then `filters.type`, "otherwise `'active'`". It returns "A promise that resolves once the refetch settles, or immediately if `refetchType` is `'none'`." For `refetchQueries`, the docs say "The returned promise does not reject on individual query failures unless `throwOnError` is `true`." The default is `cancelRefetch: true`.
- **Start, "TanStack Query" guide [11] and its `preferences.tsx` example [22]:** the official mutation is `onSuccess: () => queryClient.invalidateQueries({ queryKey: readerNameOptions.queryKey })`, an arrow function that implicitly returns the promise. "Returning the invalidation promise keeps the mutation pending until its active query's refetch finishes." The form uses `disabled={!hydrated || mutation.isPending}` and the label `'Saving...'` [22].

### 2.3 What the installed source does

- **Order and awaiting** (`query-core/build/modern/mutation.js`, `execute`) [7]: after `mutationFn` resolves, it runs `await this.#mutationCache.config.onSuccess?.(...)`, then `await this.options.onSuccess?.(...)`, then both `onSettled` callbacks, and only then `dispatch({ type: "success" })`. So `isPending` stays true while the global promise is pending, and the local `onSuccess` (for example `setReps("")`) and `mutate(..., { onSuccess })` run **after** the refetch.
- **Only active queries are refetched** (`queryClient.js`) [7]: `invalidateQueries` marks every match invalid, then calls `refetchQueries({ ...filters, type: filters?.refetchType ?? filters?.type ?? "active" })`. A query is active when it has an enabled observer (`query.js`, `isActive`) [7]. A query that only the loader's `ensureQueryData` touched, with no mounted `useSuspenseQuery`, is inactive.
- **Refetch errors are swallowed** [7]: `refetchQueries` does `if (!fetchOptions.throwOnError) promise = promise.catch(noop)` and returns `Promise.all(promises).then(noop)`. The global `onSuccess` therefore never rejects, and the mutation never moves to the error path, so `defaultOptions.mutations.onError` (the toast in `src/router.tsx`) never fires for a refetch failure.
- **What the user sees after a failed refetch** [8]: `useSuspenseQuery` uses `defaultThrowOnError = (_error, query) => query.state.data === void 0`. An existing query whose refetch fails keeps its old data and doesn't throw to the error boundary **(analysis, from `react-query/build/modern/suspense.js` and `errorBoundaryUtils.js`)**.
- **The SSR integration keeps our callback** [9]: `setupRouterSsrQueryIntegration` replaces `queryClient.getMutationCache().config` with `{ ...ogMutationCacheConfig, onError }`. It wraps only `onError` (to handle a thrown `redirect`), so a `new MutationCache({ onSuccess })` passed to the `QueryClient` survives. Official docs: "If a query or mutation throws a `redirect(...)`, the integration intercepts it" [10].
- **The client is passed in** [7]: the fifth argument to the global `onSuccess` is the `mutationFnContext`, `{ client, meta, mutationKey }`, so the callback can use `client.invalidateQueries` without a closure over the per-request `queryClient` **(analysis; the closure works too)**.

### 2.4 Trade-offs for Setlist (analysis)

| Mutation (screen) | Active query refetched | Fire-and-forget | Await |
|---|---|---|---|
| Start workout (current workout) | current workout | "Starting..." flips back to "Start Workout" when the server returns, but the empty-state card stays for one more round trip until the refetch lands. The button is clickable again in that gap. | "Starting..." stays until the active-workout view replaces the card. |
| Complete workout (current workout) | current workout. History and progression are inactive here, so they're marked stale for free. | "Completing..." flips back to "Complete Workout" while the old workout is still on screen. A click in that gap completes again, the server rejects it, and the global toast fires. | "Completing..." stays until the "No active workout" view appears. The extra history and progression keys add no wait. |
| Add set / delete set (current workout) | current workout | "Adding..." ends before the new set row appears. The local `setReps("")` clears the field early. | The label and the cleared field change in the same frame as the new row [7]. |
| Create movement (movements) | movements | Same small gap. | No gap. |
| Delete workouts (history) | history | The list still shows the deleted rows for one round trip. | "Deleting..." until the rows disappear. |

- **The cost of awaiting** is one extra read (a server function plus a Prisma query) on the pending label for each mutation. The waiting is limited to queries mounted on the current screen [6][7].
- **The navigation objection [1] doesn't apply.** No mutation here navigates on success. Sign-in and create-account do, but they aren't Query mutations (§3).
- **Stale data on the next screen happens either way.** After "Complete workout", the cached history query is only marked invalid. When the user opens history, the loader's `ensureQueryData` returns the cached data without fetching (installed `ensureQueryData` returns `cachedData` unless `revalidateIfStale` is set) [7]. `useSuspenseQuery` then refetches on mount, so old data shows for a moment. Await vs fire-and-forget doesn't change this. See §4.
- **Button state is a separate issue.** "Complete Workout" and "Start Workout" don't set `disabled={isPending}`, so a double click during the server call is possible under either option. The official example disables on `isPending` [22].

### 2.5 Recommendation

**Return the promise, from one predicate-based call (analysis).** Sketch for `src/router.tsx`:

```ts
mutationCache: new MutationCache({
  onSuccess: (_data, _variables, _onMutateResult, mutation, { client }) => {
    const keys = mutation.meta?.invalidates;
    if (!keys?.length) return;
    return client.invalidateQueries({
      predicate: (query) => keys.some((queryKey) => matchQuery({ queryKey }, query)),
    });
  },
}),
```

- No `throwOnError`. A failed refetch shouldn't turn a successful write into an error toast [6][7].
- A mutation without `meta.invalidates` does nothing. ADR 0010 says each mutation declares "a fixed list of key prefixes", and TkDodo's `?? true` invalidate-everything fallback [1] would turn a forgotten `meta` into a refetch of every active query.
- Drop the per-route `onSuccess: () => queryClient.invalidateQueries(...)` callbacks as each mutation moves to `mutationOptions`. Otherwise the same key is invalidated twice, and with `cancelRefetch: true` the second call restarts the fetch [6][7].
- If a future mutation must navigate away immediately, use TkDodo's hybrid then: a `meta` flag, or a fire-and-forget global call plus a local awaited `onSuccess` with `cancelRefetch: false` [1]. Don't build it now.

## 3. Question 2: should auth flows be mutations?

### 3.1 What the Start and Router docs say

- **Start, Authentication guide [12]:** the root route loads the user in `beforeLoad`: `beforeLoad: async () => ({ user: await getCurrentUserFn() })`. "`useServerFn` returns a callable function, not an object with `data`, `isLoading`, or `refetch`." After login or logout, "call `await router.invalidate()` to reload the current user and rerun route guards". Its `LoginForm` example: "Track pending state in the component, handle invalid credentials, and refresh route context after a successful login." It uses `useState` for `isLoading` and `error`, `const login = useServerFn(loginFn)`, checks `result?.error`, then `await router.invalidate()`. **`useMutation` and TanStack Query don't appear on the page.** Its `loginFn` and `logoutFn` end with `throw redirect(...)`.
- **Start, TanStack Query guide [11]:** "`queryClient.invalidateQueries` refreshes Query data; `router.invalidate()` reloads Router-owned loader data and route context." "Use both only when the mutation changes both, such as a login that changes root authentication context and private queries." On account data: "Request-scoped QueryClients prevent cross-request cache sharing on the server. They do not [...] automatically clear a browser cache when its account changes." On sign-out or account switching: "cancel and remove the previous account's private queries, then reload the relevant route context".
- **Start, Server Functions guide [13]:** it lists both "Components - Use with `useServerFn()` hook" and "Event handlers - Handle form submissions, clicks, etc." Redirects and not-found errors are "handled automatically when called from route lifecycles or components using `useServerFn()`". No `useMutation` example.
- **Installed `useServerFn` [18]:** it calls the server function. If the result or the thrown error is a `redirect`, it calls `router.navigate(router.resolveRedirect(err).options)`. Otherwise it passes the result or error through unchanged. Setlist's auth server functions return `{ success, error }` and never throw `redirect` (`src/lib/auth/auth.functions.ts`), so `useServerFn` would change nothing for them **(analysis)**.
- **Router, Authenticated Routes [14]:** `beforeLoad` is "a great place to check if a user is authenticated, and redirect them to a login page if they are not". Login itself isn't covered. **Router Context [16]:** `invalidate` tells "the router to recompute the context", shown with `router.invalidate()` inside an `onAuthStateChanged` listener.

### 3.2 What the official examples do (TanStack/router `main`, read 2026-11-06)

| Example | Login / sign-up call | After success | Logout |
|---|---|---|---|
| `start-basic-auth` [19] | `components/Login.tsx` imports `useMutation` from **`'../hooks/useMutation'`**, a 40-line `useState` hook, **not TanStack Query**. `fn: loginFn` (called directly) for login, `fn: useServerFn(signupFn)` for sign-up (which throws `redirect`). The error is _returned_ (`{ error: true, message }`) and shown from `loginMutation.data.message`. | `onSuccess: async (ctx) => { if (!ctx.data?.error) { await router.invalidate(); router.navigate({ to: '/' }) } }` | `routes/logout.tsx`: `preload: false`, `loader: () => logoutFn()`. The server function destroys the session and does `throw redirect({ href: '/' })`. The root renders `<Link to="/logout">`. |
| `start-supabase-basic` [20] | Same hand-rolled hook and the same `Login.tsx` shape. | Same `await router.invalidate()` then `navigate`. | Same `preload: false` + loader pattern. |
| `authenticated-routes` (Router only) [21] | `await auth.login(username)` in a form handler with `useState(isSubmitting)`. | `await router.invalidate()`, then a `sleep(1)` "hack", then `navigate`. | `auth.logout().then(() => router.invalidate().finally(() => navigate({ to: '/' })))` |
| `start-workos` [23] | Hosted sign-in. | n/a | `preload: false`, `loader: async () => { await signOut() }` |
| `start-clerk-basic` [24] | Clerk's `<SignInButton mode="modal" />`. No server function login. | n/a | n/a |
| `start-basic-react-query` [22] | No auth. Its only mutation is TanStack Query's `useMutation` + `useServerFn` for a preference cookie. | Returns `invalidateQueries`. | n/a |

**Pattern:** every official example with a hand-written login calls `router.invalidate()` afterwards [12][19][20][21]. **None uses TanStack Query's `useMutation` for login, sign-up or logout**, not even the Query-based example [22]. "An official example using TanStack Query mutations for auth" is therefore **not found**.

### 3.3 What TkDodo says

- "Logging in a user is also a classic mutation, because it performs the side effect of creating a token for the user." [2] That is a definition, not a recommendation to use `useMutation` without a cache to update.
- Put "query invalidation" in `useMutation` callbacks and "UI related things like redirects or showing toast notifications in mutate callbacks" [2].
- **Not found:** any TkDodo post on whether `useMutation` is worth it for side effects that touch no cached query.

### 3.4 Does `router.navigate` re-run the root `beforeLoad`?

**Yes.**

- Docs: "Every preload and navigation still runs its own `beforeLoad` chain" [15].
- Installed source [17]: `loadMatches` loops `for (let i = 0; i < inner.matches.length; i++) handleBeforeLoad(inner, i)`. The only skips (`shouldSkipLoader`) are a dehydrated match on the client's first load and `ssr === false` on the server. The root match's `__beforeLoadContext` is replaced on each run, so `getUserServerFn()` runs again and the layout guard sees the new `context.user`.
- What `router.invalidate()` adds [15][17]: it marks current and cached matches `invalid` and calls `router.load()` on the **current** location. "Current active routes reload through the normal loading protocol" [15]. That matters when the URL doesn't change (login rendered in place, as in [19]'s `errorComponent`) or when Router-owned loader data must be refetched. Setlist's loaders only call `ensureQueryData`, so there's no Router-owned data to refresh **(analysis)**.
- In Setlist, `sign-in.tsx` and `create-account.tsx` already redirect to `/` when `context.user` is set. So `await router.invalidate()` _alone_ would also work: it re-runs root `beforeLoad`, and the page's own guard then redirects. Calling it _and_ `navigate` sends you to `/` twice, which is harmless but redundant **(analysis)**.
- Logout today: `<a href="/logout">` does a full load, the effect calls `logoutServerFn()`, then `router.navigate({ to: "/sign-in" })` re-runs root `beforeLoad` with no cookie, so `user` is `null` [17].

### 3.5 Would `useMutation` help here? (analysis)

- **`isPending` and `error` instead of `useState`:** this saves about three lines per page. Failure comes back as `{ success: false, error }`, which the mutation treats as _success_ [7], so the inline message would come from `mutation.data?.error`. That's no simpler than today's `result.error`.
- **The global toast:** `defaultOptions.mutations.onError` fires only when `mutationFn` rejects [7]. "Invalid email or password" is returned, not thrown, so it wouldn't be toasted twice. A _thrown_ error, such as a network failure or a Zod `inputValidator` rejection, would show the toast **and** whatever inline error the page renders from `mutation.error`. Avoiding that means overriding `onError` in the auth `mutationOptions`, since defaults "can be overridden by each mutation" [5][7]. That's more code than today.
- **`meta.invalidates`:** the user isn't in the Query cache, so there's nothing to declare. The cache to refresh is the router's, through `navigate` or `router.invalidate()` [11][12].
- **Consistency:** the only real benefit is that every write would look the same. Against that, the primary sources don't do it [12][19][20][21], and it adds a `queries.ts` that holds no queries.

### 3.6 Recommendation

**Keep direct calls. Don't add `src/lib/auth/queries.ts` (analysis).**

- `sign-in.tsx` and `create-account.tsx`: leave them as they are. This matches the official Start auth guide's shape (call, local `useState`, refresh route context) [12]. `router.navigate({ to: "/" })` already refreshes `context.user` [15][17]. Optionally replace it with `await router.invalidate()` to match the docs word for word [12]. Don't use both. `useServerFn` is optional, because these functions never throw `redirect` [18].
- `logout.tsx`: keep the full-page `<a href="/logout">`. The reload also gives the browser a fresh QueryClient, which covers the Start guide's sign-out rule [11]. A later change could move it to the official shape (`preload: false`, `loader: () => logoutServerFn()` throwing `redirect`, `<Link to="/logout">`) [19][20][23]. That change needs `queryClient.clear()` (present in installed 5.90.18 [7]) or `removeQueries` before the redirect. ADR 0009's database-backed sessions change only the server function, not how it's called.

## 4. Risks and open questions

1. **Missing `meta` in the global callback.** If `onSuccess` copies TkDodo's `?? true` fallback [1], every mutation without `meta.invalidates` invalidates everything. That includes auth, if it ever becomes a mutation. Today's auth pages have no active queries, so it would be cheap, but it's a trap. §2.5 recommends a no-op, which is what `src/router.tsx` does.
2. **Silent stale data after a failed refetch.** With either option, a failed refetch leaves the mutation `success` and the query in `error` with its old data. `useSuspenseQuery` doesn't throw while data exists [8], and only mutations toast [7]. Nothing tells the user. A `QueryCache({ onError })` toast for background failures would fix it. Out of scope here.
3. **Stale data when opening a screen whose key was invalidated off-screen.** The loader's `ensureQueryData` returns cached data even when invalidated [7], and the component then refetches on mount, so old data flashes. This is independent of Q1. Possible fixes: `refetchType: 'all'` for specific keys (refetches inactive queries too, which an awaited callback would then wait for), or `revalidateIfStale` / `prefetchQuery` in loaders. The newer `queryClient.query` API [10][11] may change this. Unverified.
4. **Browser cache across accounts.** The full-page logout is the only thing that clears the client QueryClient today **(analysis)**. Any change to a client-side logout (`<Link>`, a button, `router.navigate`) must add `queryClient.clear()` or `removeQueries`, per [11].
5. **A `redirect` thrown inside a Query mutation.** `authMiddleware` throws `redirect({ to: "/sign-in" })` when the session is gone. The SSR integration's cache-level `onError` navigates [9][10], but the option-level default `onError` in `src/router.tsx` still runs [7] and would toast `error.message` of a redirect object. Unverified in the browser. Guard the toast with `isRedirect(error)`.
6. **Doc versus installed version.** The `main` docs and examples (`queryClient.query`, `.validator`, `useHydrated`) are newer than 1.150.0 / 5.90.18. The behaviours relied on here were checked in installed source [7][8][9][17][18], but a Start or Query upgrade should re-check `refetchQueries` error handling and the `beforeLoad` loop.
7. **Unverified:** an official example using TanStack Query's `useMutation` for auth (not found); a TkDodo post on `useMutation` for side effects that update no cached query (not found); the browser behaviour in risk 5 (not tested).

## 5. Sources

All accessed 2026-11-06.

1. TkDodo, "Automatic Query Invalidation after Mutations" (2024-05-25, updated 2025-11-25): https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
2. TkDodo, "Mastering Mutations in React Query" (2021-10-09, updated 2023-10-21): https://tkdodo.eu/blog/mastering-mutations-in-react-query
3. TanStack Query docs, "Invalidations from Mutations" (v5): https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations (raw: `TanStack/query` `docs/framework/react/guides/invalidations-from-mutations.md`)
4. TanStack Query docs, `UseMutationOptions` reference (generated): https://github.com/TanStack/query/blob/main/docs/framework/react/reference/interfaces/UseMutationOptions.md
5. TanStack Query docs, `MutationCacheConfig` reference (generated): https://github.com/TanStack/query/blob/main/docs/framework/react/reference/interfaces/MutationCacheConfig.md. The tanstack.com `MutationCache` page (https://tanstack.com/query/latest/docs/reference/MutationCache) still documents no callbacks.
6. TanStack Query docs, `QueryClient` class reference (`invalidateQueries`, `refetchQueries`): https://github.com/TanStack/query/blob/main/docs/framework/react/reference/classes/QueryClient.md
7. Installed `@tanstack/query-core` 5.90.18: `node_modules/@tanstack/query-core/build/modern/mutation.js` (`execute`), `queryClient.js` (`invalidateQueries`, `refetchQueries`, `ensureQueryData`, `defaultMutationOptions`, `clear`), `query.js` (`isActive`, `isDisabled`), `index.js` (`matchQuery` export)
8. Installed `@tanstack/react-query` 5.90.18: `node_modules/@tanstack/react-query/build/modern/suspense.js` (`defaultThrowOnError`), `errorBoundaryUtils.js` (`getHasError`), `useSuspenseQuery.js`
9. Installed `@tanstack/router-ssr-query-core` 1.150.0: `node_modules/@tanstack/router-ssr-query-core/dist/esm/index.js` (`handleRedirects` wraps `mutationCache.config.onError`)
10. TanStack Router docs, "TanStack Query Integration" (Redirect handling): https://tanstack.com/router/latest/docs/integrations/query
11. TanStack Start docs, "TanStack Query" guide: https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query
12. TanStack Start docs, "Authentication" guide: https://tanstack.com/start/latest/docs/framework/react/guide/authentication
13. TanStack Start docs, "Server Functions" guide: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
14. TanStack Router docs, "Authenticated Routes" (raw: `TanStack/router` `docs/router/guide/authenticated-routes.md`): https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes
15. TanStack Router docs, "Data Loading" (raw: `docs/router/guide/data-loading.md`): https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
16. TanStack Router docs, "Router Context" (raw: `docs/router/guide/router-context.md`): https://tanstack.com/router/latest/docs/framework/react/guide/router-context
17. Installed `@tanstack/router-core` 1.150.0: `node_modules/@tanstack/router-core/dist/esm/load-matches.js` (`loadMatches`, `handleBeforeLoad`, `shouldSkipLoader`), `dist/esm/router.js` (`invalidate`)
18. Installed `@tanstack/react-start` 1.150.0: `node_modules/@tanstack/react-start/dist/esm/useServerFn.js`
19. TanStack/router example `start-basic-auth` (`src/components/Login.tsx`, `src/hooks/useMutation.ts`, `src/routes/signup.tsx`, `src/routes/logout.tsx`, `src/routes/_authed.tsx`, `src/routes/__root.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-basic-auth
20. TanStack/router example `start-supabase-basic` (`src/components/Login.tsx`, `src/routes/signup.tsx`, `src/routes/logout.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-supabase-basic
21. TanStack/router example `authenticated-routes` (`src/routes/login.tsx`, `src/routes/_auth.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/authenticated-routes
22. TanStack/router example `start-basic-react-query` (`src/routes/preferences.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-basic-react-query
23. TanStack/router example `start-workos` (`src/routes/logout.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-workos
24. TanStack/router example `start-clerk-basic` (`src/routes/__root.tsx` read raw): https://github.com/TanStack/router/tree/main/examples/react/start-clerk-basic
