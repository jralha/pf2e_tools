import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Compass, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { TOOLS } from "../tools/registry";

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 dark:border-zinc-800/80 bg-stone-50/90 dark:bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900 dark:text-zinc-100 hover:opacity-90"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-crimson-600 text-amber-100 shadow-sm ring-1 ring-gold-500/40">
                <Compass className="h-4.5 w-4.5" />
              </span>
              <span className="text-lg">
                PF2e <span className="text-crimson-600 dark:text-gold-400">Tools</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Tools">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-stone-200/80 text-stone-950 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
                  }`
                }
              >
                All Tools
              </NavLink>
              {TOOLS.map((tool) => (
                <NavLink
                  key={tool.id}
                  to={tool.path}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-crimson-600/10 text-crimson-700 dark:bg-crimson-600/20 dark:text-gold-400"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
                    }`
                  }
                >
                  {tool.name}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-gold-400" />
              ) : (
                <Moon className="h-4 w-4 text-stone-700" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            className="md:hidden border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 px-4 py-3 space-y-1"
            aria-label="Mobile Navigation"
          >
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? "bg-stone-200/80 text-stone-950 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-stone-600 dark:text-zinc-400"
                }`
              }
            >
              All Tools
            </NavLink>
            {TOOLS.map((tool) => (
              <NavLink
                key={tool.id}
                to={tool.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? "bg-crimson-600/10 text-crimson-700 dark:bg-crimson-600/20 dark:text-gold-400"
                      : "text-stone-600 dark:text-zinc-400"
                  }`
                }
              >
                {tool.name}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-stone-200/70 dark:border-zinc-800/70 py-5 text-center text-xs text-stone-500 dark:text-zinc-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PF2e Tools — Pathfinder 2nd Edition tabletop utilities</span>
          <span>100% client-side · Zero tracking</span>
        </div>
      </footer>
    </div>
  );
}
