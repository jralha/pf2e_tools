# PF2e Tools

A fast, client-side collection of utility tools for **Pathfinder 2nd Edition**, built with React, Vite, TypeScript, and Tailwind CSS, and deployed to GitHub Pages.

## Available Tools

- **AoE Calculator** (`/#/tools/aoe`) — Interactive 5-foot grid visualizer for PF2e **Emanations**, **Bursts**, and **Cones** across all standard token sizes, with enemy token placement, max elevation overlay, and live hit detection using the alternating 5/10/5/10 diagonal rule.
- **Airburst Calculator** (`/#/tools/airburst`) — Calculates the ground-level burst footprint when detonating a burst in mid-air, with side-view cross-section and top-down ground plots.
- **Dragon Breath Calculator** (`/#/tools/dragon-breath`) — Calculates the effective ground burst when a flying creature aims a breath cone straight down, with side-view cross-section and top-down ground plots.
- **Damage Calculator** (`/#/tools/damage`) — Basic dice expression histogram (`2d6 + 2`) and Advanced PF2e Attack/Basic Save DPR calculator with raw probability input, Deadly/Fatal crits, and weakness/resistance.

## TODO

- [ ] Create a dedicated **Line Calculator** tool.

## Local Development

```bash
npm install
npm run dev
```

### Testing & Production Build

```bash
npm test          # Run Vitest unit tests
npm run build     # Type-check and build static site to dist/
npm run preview   # Preview the production build locally
```

## Adding a New Tool

The site uses a central tool registry so new tools automatically appear in the home directory, navigation bar, and router:

1. Create a folder under `src/tools/<tool-id>/` with a default-exported React component (e.g., `src/tools/line/LineTool.tsx`).
2. Add any reusable PF2e math/rules helpers to `src/lib/pf2e/` with accompanying `*.test.ts` unit tests.
3. Register the tool in `src/tools/registry.ts` with a `React.lazy` import.
