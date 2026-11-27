import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { TOOLS } from "../tools/registry";

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3 border-b border-stone-200 dark:border-zinc-800 pb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-crimson-600/25 bg-crimson-600/10 px-3 py-1 text-xs font-medium text-crimson-700 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-400">
          <Sparkles className="h-3.5 w-3.5" />
          Pathfinder 2nd Edition
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
          Tabletop Utility Suite
        </h1>
        <p className="max-w-2xl text-base text-stone-600 dark:text-zinc-400">
          Fast, client-side calculators and grid visualizers built for Pathfinder
          2e sessions. Pick a tool below to get started.
        </p>
      </section>

      <section aria-labelledby="tools-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="tools-heading"
            className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400"
          >
            Available Tools ({TOOLS.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                to={tool.path}
                className="group flex flex-col justify-between rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs hover:border-crimson-600/50 dark:hover:border-gold-500/50 hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-crimson-600/10 text-crimson-700 dark:bg-crimson-600/20 dark:text-gold-400 ring-1 ring-crimson-600/15 dark:ring-gold-500/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-md bg-stone-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:text-zinc-400">
                      {tool.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 dark:text-zinc-100 group-hover:text-crimson-600 dark:group-hover:text-gold-400 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                      {tool.shortDescription}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tool.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-stone-100 dark:bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-crimson-700 dark:text-gold-400 shrink-0">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
