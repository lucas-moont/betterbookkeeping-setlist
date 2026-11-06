import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { MutationCache, QueryClient, matchQuery, type QueryKey } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { ErrorCode } from "@/lib/error-codes";
import { isFormError } from "@/lib/server-mutation";

// Create a new router instance
export const getRouter = () => {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Each mutation lists the key prefixes it makes stale in meta.invalidates (ADR 0010).
      // Returning the promise keeps the mutation pending until the queries on screen have refetched.
      onSuccess: (_data, _variables, _onMutateResult, mutation, { client }) => {
        const keys = mutation.meta?.invalidates;
        if (!keys?.length) return;
        return client.invalidateQueries({
          predicate: (query) => keys.some((queryKey) => matchQuery({ queryKey }, query)),
        });
      },
      // Runs for every mutation, besides the page's own onError. A code the mutation lists in
      // meta.formErrors is shown by its form, next to the field, so it gets no toast.
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (!isFormError(error, mutation.meta)) toast.error(error.message);
      },
    }),
  });

  const router = createTanstackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { invalidates?: readonly QueryKey[]; formErrors?: readonly ErrorCode[] };
  }
}
