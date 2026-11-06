import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { MutationCache, QueryClient, matchQuery, type QueryKey } from "@tanstack/react-query";
import { toast } from "react-toastify";

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
    }),
    defaultOptions: {
      mutations: {
        onError: (error) => {
          toast.error(`${error.message}`);
        },
      },
    },
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
    mutationMeta: { invalidates?: readonly QueryKey[] };
  }
}
