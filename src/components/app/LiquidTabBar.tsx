import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { LucideIcon } from "./icons";

type Tab = { to: string; label: string; icon: LucideIcon };

function indexFor(tabs: readonly Tab[], pathname: string) {
  const exact = tabs.findIndex((t) => t.to === pathname);
  if (exact >= 0) return exact;
  // Sub-pages (e.g. /talebe/...) belong to the first tab.
  const prefix = tabs.findIndex((t) => t.to !== "/" && pathname.startsWith(t.to));
  return prefix >= 0 ? prefix : 0;
}

/**
 * Bottom tab bar. The indicator is positioned with pure CSS percentages
 * (no measuring), so it is visible in the very first server render and
 * moves instantly on tap, before the next page finishes loading.
 */
export function LiquidTabBar({ tabs }: { tabs: readonly Tab[] }) {
  const { pathname } = useLocation();
  const routeIndex = indexFor(tabs, pathname);
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => setTapped(null), [routeIndex]);
  const active = tapped ?? routeIndex;
  const n = tabs.length;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-background px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:px-4">
      <div className="pointer-events-auto rounded-[2rem] border border-border bg-card p-1.5 shadow-md">
        <div
          className="relative grid select-none"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          <span
            aria-hidden
            className="glass-bubble absolute inset-y-0 left-0 rounded-[1.6rem]"
            style={{
              width: `${100 / n}%`,
              transform: `translate3d(${active * 100}%,0,0)`,
              transition: "transform 280ms cubic-bezier(0.32, 1.25, 0.55, 1)",
              willChange: "transform",
            }}
          />
          {tabs.map(({ to, label, icon: Icon }, i) => {
            const on = i === active;
            return (
              <Link
                key={to}
                to={to}
                draggable={false}
                preload="render"
                aria-current={on ? "page" : undefined}
                onClick={() => i !== active && setTapped(i)}
                className={`relative z-10 flex flex-col items-center gap-0.5 rounded-[1.6rem] py-2 text-[11px] transition-[color,transform] duration-200 active:scale-95 ${
                  on ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon
                  className={`h-[22px] w-[22px] transition-transform duration-200 ${on ? "scale-110" : ""}`}
                  strokeWidth={on ? 2.4 : 1.8}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
