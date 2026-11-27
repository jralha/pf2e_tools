import { Minus, Plus, Trash2, Users, X } from "lucide-react";
import {
  TOKEN_SIZES,
  type EnemyToken,
  type TokenSizeName,
} from "../lib/pf2e/grid";

export interface EnemySummaryItem {
  enemy: EnemyToken;
  subtitle: string;
  hit: boolean;
}

interface EnemyTokensCardProps {
  items: readonly EnemySummaryItem[];
  enemySizeLabel: TokenSizeName;
  onEnemySizeChange: (size: TokenSizeName) => void;
  onElevationChange: (id: number, deltaFt: number) => void;
  onRemoveEnemy: (id: number) => void;
  onClearEnemies: () => void;
  emptyHint?: string;
}

export function EnemyTokensCard({
  items,
  enemySizeLabel,
  onEnemySizeChange,
  onElevationChange,
  onRemoveEnemy,
  onClearEnemies,
  emptyHint = "No enemies placed yet. Click any open square on the grid to drop an enemy token.",
}: EnemyTokensCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-crimson-600 dark:text-gold-400" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
            Enemy Tokens
          </h2>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearEnemies}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:text-crimson-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-crimson-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="enemy-size"
          className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
        >
          Enemy Size to Drop (click map to place)
        </label>
        <select
          id="enemy-size"
          value={enemySizeLabel}
          onChange={(e) => onEnemySizeChange(e.target.value as TokenSizeName)}
          className="w-full rounded-lg border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1.5 text-sm text-stone-900 dark:text-zinc-100 focus:border-crimson-600 dark:focus:border-gold-400 focus:outline-none"
        >
          {TOKEN_SIZES.map((size) => (
            <option key={size.name} value={size.name}>
              {size.name} — {size.feetLabel}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-zinc-400">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-60 overflow-y-auto pr-1">
          {items.map(({ enemy, subtitle, hit }) => (
            <li
              key={enemy.id}
              className="py-2 flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-5 w-7 shrink-0 items-center justify-center rounded font-bold text-[11px] text-white ${
                    hit ? "bg-crimson-600" : "bg-slate-600 dark:bg-zinc-600"
                  }`}
                >
                  {enemy.label}
                </span>
                <span className="truncate text-stone-700 dark:text-zinc-300">
                  {subtitle}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="inline-flex items-center rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950"
                  title="Enemy elevation above ground"
                >
                  <button
                    type="button"
                    onClick={() => onElevationChange(enemy.id, -5)}
                    disabled={enemy.elevationFt <= 0}
                    aria-label={`Decrease ${enemy.label} elevation`}
                    className="px-1 py-0.5 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-1 min-w-[2.5rem] text-center tabular-nums font-medium text-[11px] text-stone-800 dark:text-zinc-200">
                    ↑{enemy.elevationFt} ft
                  </span>
                  <button
                    type="button"
                    onClick={() => onElevationChange(enemy.id, 5)}
                    disabled={enemy.elevationFt >= 120}
                    aria-label={`Increase ${enemy.label} elevation`}
                    className="px-1 py-0.5 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    hit
                      ? "bg-crimson-600/15 text-crimson-700 dark:bg-crimson-500/20 dark:text-crimson-300"
                      : "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {hit ? "Hit" : "Safe"}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveEnemy(enemy.id)}
                  aria-label={`Remove ${enemy.label}`}
                  className="p-0.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
