# NEXAI 2026 — Warehouse Digital Twin

An interactive browser-based warehouse slotting game built from a processed UCI Online Retail II order stream. It tests how product placement changes picker walking distance under a consistent, aisle-aware warehouse model.

## What works

- Real-data preprocessing for November 2011: 100 products and 2,341 exported orders.
- Deterministic A* routes that respect rack obstacles and rack-face access points.
- Fair original, automatic fast-mover, and player-layout scoring from the same order stream.
- Three.js warehouse with a picker and route overlay that consume actual scoring events.
- Slotting Lab with search, product swapping, undo, reset, session-local layout persistence, and baseline application.
- Analytics comparison and a rack-visit heatmap generated from simulation events.
- WebGL and data-load recovery views.
- Keyboard-focusable controls and a reduced-motion-aware interface.

## Technology

React, Vite, TypeScript, Three.js, React Three Fiber, Drei, Recharts, Lucide React, Vitest, Python, pandas, and openpyxl.

## Dataset and processing

The source is [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii), licensed CC BY 4.0. The pipeline reads `Year 2010-2011`, selects November 2011, and removes cancelled invoices, missing invoice/timestamp records, non-positive quantities, and non-product codes. The top 100 products are selected by eligible units ordered. Lines outside that set are excluded from the compact browser dataset and repeated products on an invoice are aggregated. To substitute another Retail II export, provide equivalent `Invoice`, `StockCode`, `Description`, `Quantity`, and `InvoiceDate` columns to the preprocessing script.

Actual output: 83,215 eligible source lines, 100 products, 2,341 orders, 14,043 product picks, and 266,506 handled units. See [the data-quality report](docs/data-quality-report-2011-11.json).

## Routing and scoring

The warehouse is a 30 × 20 grid with 1.5 m cells, six rack blocks, a packing dock, and 252 valid rack-face slots. The picker uses four-direction A* and returns to the dock at the end of each order. The original layout is a disclosed neutral lexical-SKU placement because the source data includes no physical warehouse position.

The baseline ranks products by eligible units and slots by dock round-trip cost, then assigns fast movers to lower-cost slots. Estimated time includes walking at 1.2 m/s plus 5 seconds per product line and 1 second per handled unit. These are simulation assumptions, not observed labour measurements.

Read the full [warehouse model](docs/warehouse-model.md) and [simulation methodology](docs/simulation-method.md).

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run check
npm run test
npm run build
```

## Regenerate the dataset

The source workbook is intentionally not committed. With an authorized local copy:

```bash
/Users/kishore/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/process_retail_data.py /path/to/online_retail_II.xlsx
```

## Deploy

The repository is Vercel-compatible. Import it into Vercel as a Vite project; the build command is `npm run build` and the output directory is `dist`.

## Limitations and next steps

This MVP models a single picker, no congestion, and a nearest-next-pick order policy. Batch picking, multiple pickers, true drag-and-drop in the 3D scene, shared leaderboards, and measured warehouse calibration are future work.

## Team and links

Add team members, deployment URL, demo video, and development log link before final competition submission.
