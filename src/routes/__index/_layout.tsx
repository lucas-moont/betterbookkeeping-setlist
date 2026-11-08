import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Dumbbell, History, BicepsFlexed, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/__index/_layout")({
  component: RouteComponent,
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/sign-in" });
    return { user: context.user! };
  },
});

const navItems = [
  { to: "/current-workout", label: "Current Workout", short: "Workout", icon: Dumbbell },
  { to: "/workout-history", label: "Workout History", short: "History", icon: History },
  { to: "/movements", label: "Movements", short: "Movements", icon: BicepsFlexed },
] as const;

// Signing out loads /logout as a new page, not a client-side navigation: the reload also empties the
// query cache, so the next user to sign in on this browser never sees the last one's data.
const logoutHref = "/logout";

function RouteComponent() {
  const { user } = Route.useRouteContext();
  return (
    // The shell is exactly the window's height: the navigation stays put and only the page content
    // scrolls. From md up, a sidebar with the user block always in view; below it, a top bar with the
    // wordmark and a bottom bar with the five destinations (DESIGN.md, Layout).
    <div className="h-dvh flex flex-col bg-slate-50 md:flex-row">
      <header className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-4 md:hidden">
        <img src="/wordmark.svg" alt="Setlist" className="h-5" />
      </header>
      <nav
        aria-label="Main"
        className="hidden w-64 shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-4 md:flex md:flex-col">
        <img src="/wordmark.svg" alt="Logo" className="h-6 mb-8" />
        <div className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors [&.active]:bg-slate-100 [&.active]:text-slate-900">
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
          {/* The way into the Profile: the user's own block, active while the Profile is open. */}
          <Link
            to="/profile"
            className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors [&.active]:bg-slate-100 [&.active]:text-slate-900">
            <User className="w-4 h-4" />
            <div className="truncate">
              <p className="text-xs text-slate-500 group-hover:text-slate-600 group-[.active]:text-slate-600">
                Logged in as
              </p>
              <p className="font-medium truncate">{user.name || user.email}</p>
            </div>
          </Link>
          <a href={logoutHref}>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-slate-600">
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </a>
        </div>
      </nav>
      {/* On phones the bottom padding clears the fixed bar, safe area included. */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50";

/**
 * The phone navigation: the three pages, the Profile and Log out, fixed to the bottom of the screen
 * within thumb reach. The active page gets the Hover Wash pill behind its icon. Log out is an action,
 * so it is a button and never active, and it signs out at once, as the sidebar's does.
 */
function BottomNav() {
  const items = [...navItems, { to: "/profile", short: "Profile", icon: User }] as const;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ to, short, icon: Icon }) => (
        <Link key={to} to={to} className={cn(tabClass, "group [&.active]:text-slate-900")}>
          <span className="inline-flex h-7 w-12 items-center justify-center rounded-full group-[.active]:bg-slate-100">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          {short}
        </Link>
      ))}
      <button type="button" onClick={() => window.location.assign(logoutHref)} className={tabClass}>
        <span className="inline-flex h-7 w-12 items-center justify-center rounded-full">
          <LogOut aria-hidden="true" className="h-5 w-5" />
        </span>
        Log out
      </button>
    </nav>
  );
}
