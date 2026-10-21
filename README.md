# NEXAI 2026 — Warehouse Digital Twin

## Phase 1 status

This repository contains the verified TypeScript + React + Vite foundation, command-center shell, and reproducible UCI Online Retail II preprocessing pipeline. It does **not** yet claim that simulation, 3D routing, or optimisation are complete.

### Current foundation

- Strict TypeScript React/Vite application scaffold.
- Responsive cyber-industrial command-center interface.
- State-aware controls that report why unavailable features are unavailable.
- Explicit empty states rather than fabricated warehouse metrics.
- Browser-ready JSON derived from the supplied UCI workbook for November 2011, served as `/data/retail-2011-11.json`.
- Data-quality report and Python tests for core cleaning and schema rules.

### Planned source attribution

The intended data source is [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii), distributed under CC BY 4.0. A selected month, cleaning rules, pipeline output, and derived statistics will be documented when the preprocessing phase is implemented.

### Run locally

```bash
npm install
npm run dev
```

### Checks

```bash
npm run check
npm run build
npm run test
```

### Regenerate the real dataset

The pipeline uses the `Year 2010-2011` worksheet and selects November 2011. It excludes cancelled invoices, missing invoices/timestamps, non-positive quantities, and non-product codes. Products are ranked by eligible units ordered; the top 100 are retained. Lines outside those products are removed from exported orders, and duplicate product lines within an invoice are aggregated.

```bash
/Users/kishore/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/process_retail_data.py /path/to/online_retail_II.xlsx
```

### Warehouse model and routing

The deterministic aisle model, slot rules, and A* route policy are documented in [`docs/warehouse-model.md`](docs/warehouse-model.md). It uses a 30 × 20 grid, 1.5 m cell edges, rack obstacles, and reachable rack-face access cells.

### Simulation methodology

The fair scoring policy, travel and handling assumptions, automatic fast-mover baseline, and reduction formula are documented in [`docs/simulation-method.md`](docs/simulation-method.md). The engine is tested against all 2,341 processed real-data orders; its UI presentation is the following phase.

### Interactive digital twin

The command center now lazy-loads an interactive Three.js warehouse. Orbit, pan, and zoom are available in the viewport. The picker, cyan route overlay, target telemetry, and step controls all consume a real scored pick event from the first exported order. A clear non-WebGL fallback stays available when hardware acceleration is not available.

## Team

Team details, deployment URL, demo video, and development log links are intentionally left to be supplied by the project team.
