# NEXAI 2026 — Warehouse Digital Twin

An interactive browser-based warehouse slotting game built from a processed UCI Online Retail II order stream. It tests how product placement changes picker walking distance under a consistent, aisle-aware warehouse model.

## What works

- Real-data preprocessing for November 2011: 100 products and 2,341 exported orders.
- Deterministic A* routes that respect rack obstacles and rack-face access points.
- Fair original, automatic fast-mover, and player-layout scoring from the same order stream.
- Three.js warehouse with a picker and route overlay that consume actual scoring events.
- Layer filters switch to the rack model and show only the selected shelf level; replay also switches to the live model so the picker follows walkable aisle paths.
- Slotting Lab with search, product swapping, undo, reset, session-local layout persistence, and baseline application.
- Analytics comparison and a rack-visit heatmap generated from simulation events.
- WebGL and data-load recovery views.
- Keyboard-focusable controls and a reduced-motion-aware interface.

## Technology

React 18, Vite, strict TypeScript, Three.js, React Three Fiber, Drei, Recharts, Lucide React, Vitest, Python, pandas, and openpyxl. Frontend dependencies are pinned in `package-lock.json` so fresh installs use the same major versions as the tested build.

## Dataset and processing

The source is [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii), licensed CC BY 4.0. The pipeline reads `Year 2010-2011`, selects November 2011, and removes cancelled invoices, missing invoice/timestamp records, non-positive quantities, and non-product codes. The top 100 products are selected by eligible units ordered. Lines outside that set are excluded from the compact browser dataset and repeated products on an invoice are aggregated. To substitute another Retail II export, provide equivalent `Invoice`, `StockCode`, `Description`, `Quantity`, and `InvoiceDate` columns to the preprocessing script.

Actual output: 83,215 eligible source lines, 100 products, 2,341 orders, 14,043 product picks, and 266,506 handled units. See [the data-quality report](docs/data-quality-report-2011-11.json).

## Routing and scoring

The warehouse is a 30 × 20 grid with 1.5 m cells, six rack blocks, a packing dock, and 252 valid rack-face slots. The picker uses four-direction A* and returns to the dock at the end of each order. The original layout is a disclosed neutral lexical-SKU placement because the source data includes no physical warehouse position.

The baseline ranks products by eligible units and slots by dock round-trip cost, then assigns fast movers to lower-cost slots. Estimated time includes walking at 1.2 m/s plus 5 seconds per product line and 1 second per handled unit. These are simulation assumptions, not observed labour measurements.

Read the full [warehouse model](docs/warehouse-model.md) and [simulation methodology](docs/simulation-method.md).

## Run locally

```bash
npm ci
npm run dev
```

## Verify

Install Python dependencies once for the dataset-processing tests:

```bash
python3 -m pip install -r requirements.txt
```

Then run the full local gate:

```bash
npm run verify
```

Or run the checks individually:

```bash
npm run check
npm run test
npm run test:python
npm run audit
npm run build
```

The same checks run on pushes and pull requests through `.github/workflows/verify.yml`.

## Regenerate the dataset

The source workbook is intentionally not committed. With an authorized local copy:

```bash
python3 scripts/process_retail_data.py /path/to/online_retail_II.xlsx
```

## Deploy

**Live demo:** https://my-new-idp-repo-i-dev1.vercel.app/

**Public repository:** [https://github.com/kishore-23MIC0100/my-new-idp-repo](https://github.com/kishore-23MIC0100/my-new-idp-repo)

The application is deployed on Vercel as a static Vite site. Build command: `npm run build`; output directory: `dist`. The live URL was checked on 22 October 2026 and returned HTTP 200. Its dataset endpoint also loaded successfully with 100 products and 2,339 orders. The checked-in dataset currently contains 2,341 orders; synchronize the Vercel deployment and repository data before the final demo so the displayed counts agree.

## Limitations and next steps

This MVP models a single picker, no congestion, and a nearest-next-pick order policy. Batch picking, multiple pickers, true drag-and-drop in the 3D scene, shared leaderboards, and measured warehouse calibration are future work.

## Team and links

Add the official names and roles before submission. These details were not provided when this README was updated, so the fields below are intentionally left for the team to complete.

| Team member name | Role / contribution | Student ID (if required) |
| --- | --- | --- |
| [Add full name] | [Add role] | [Add only if required] |
| [Add full name] | [Add role] | [Add only if required] |

**Official team ID (if assigned):** [Add official team ID]

See [DEV_LOG.md](DEV_LOG.md) for design decisions, experiments, AI assistance, and verification results. Add the final demo recording, pitch deck, and public-post URLs here when they are ready.
