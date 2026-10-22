# NEXAI 2026 — Warehouse Digital Twin

An interactive browser-based warehouse slotting game built from a processed UCI Online Retail II order stream. It tests how product placement changes picker walking distance under a consistent, aisle-aware warehouse model.

## What works

- Real-data preprocessing for November 2011: 100 products and 2,339 exported orders.
- Deterministic A* routes that respect rack obstacles and rack-face access points.
- Fair original, automatic fast-mover, and player-layout scoring from the same order stream.
- Three.js warehouse with one to four articulated human pickers, distinct real orders, selectable telemetry, a follow camera, and a route overlay driven by actual scoring events.
- Slotting Lab with all 100 products and all 252 slots, empty-slot moves, swaps, undo, reset, browser-local persistence, JSON import/export, and baseline application.
- Analytics comparison and a spatial, layer-filtered rack heatmap generated from simulation events. Order charts include the return to dock.
- A shared elapsed-time replay clock with pause/resume, restart, next event, order selection, and 1–60× speed. Handling time and the final dock return are animated and scored consistently.
- WebGL and data-load recovery views.
- Keyboard-focusable controls and a reduced-motion-aware interface.

## Technology

React, Vite, TypeScript, Three.js, React Three Fiber, Drei, Recharts, Lucide React, Vitest, Python, pandas, and openpyxl.

## Dataset and processing

The source is [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii), licensed CC BY 4.0. The pipeline reads `Year 2010-2011`, selects November 2011, and removes cancelled invoices, missing invoice/timestamp records, non-positive quantities, and non-product codes. The top 100 products are selected by eligible units ordered. Lines outside that set are excluded from the compact browser dataset and repeated products on an invoice are aggregated. To substitute another Retail II export, provide equivalent `Invoice`, `StockCode`, `Description`, `Quantity`, and `InvoiceDate` columns to the preprocessing script.

Actual output: 83,215 eligible source lines, 100 products, 2,339 orders, 14,042 product picks, and 266,506 handled units. Two invoices with differing timestamps are consolidated by invoice ID, using the earliest retained timestamp. See [the data-quality report](docs/data-quality-report-2011-11.json).

## Routing and scoring

The warehouse is a 30 × 20 grid with 1.5 m cells, six rack blocks, a packing dock, and 252 valid rack-face slots. The picker uses four-direction A* and returns to the dock at the end of each order. The original layout is a disclosed neutral lexical-SKU placement because the source data includes no physical warehouse position.

The baseline ranks products by eligible units and slots by dock round-trip cost, then assigns fast movers to lower-cost slots. Estimated time includes walking at 1.2 m/s plus 5 seconds per product line and 1 second per handled unit. These are simulation assumptions, not observed labour measurements.

Read the full [warehouse model](docs/warehouse-model.md) and [simulation methodology](docs/simulation-method.md).

## Run locally

Requires Node.js 22.12+ (tested with 24.21.0). Dependencies are locked in `package-lock.json`.

```powershell
npm ci
npm run dev
```

For the production preview, run `npm run build` then `npm run preview -- --host 127.0.0.1 --port 4174`. Open http://127.0.0.1:4174. The warehouse is a real Three.js scene, with no image background. Left drag or the Orbit/Pan/Zoom toolbar controls the camera; Reset restores the overview. Product categories are disclosed keyword groups inferred from descriptions, not fields supplied by UCI.

The six KPI cards describe the **whole scored workload**. The right panels describe **only the selected order replay**. Distance reduction replaces an undefined “route efficiency” percentage: it has a documented denominator and makes no claim of optimal routing. Edits autosave in this browser when storage is available. Export a layout to transfer it to another browser.

## Verify

```powershell
npm run check
npm run lint
npm test
npm run test:python
npm run build
npm run test:browser
```

Python checks require `pip install -r requirements.txt`. Browser checks use Playwright Chromium (`npx playwright install chromium` if missing), start and stop their own production preview on port 4173, and save screenshots under ignored `artifacts/`. Unit tests cover data validation, routing obstacles, fair scoring, input failures, layout conservation, clock interpolation, handling, and dock return.

## Regenerate the dataset

The source workbook is intentionally not committed. With an authorized local copy:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe scripts/process_retail_data.py D:\spm\game\online_retail_II.xlsx
```

Outputs are deterministic and include the workbook SHA-256 hash. Timestamps retain the source UK local wall time without conversion. No customer IDs or countries are exported. Cancellation invoices, invalid/missing codes or dates, and non-finite/non-positive quantities are excluded. Missing descriptions use the first nonempty description per SKU or “Unknown product.” The report accounts for 68,617 eligible lines outside the selected product set and 525 invoices left with no selected products. Frequency means **eligible units**, while a pick means **one aggregated invoice/SKU**.

Dataset attribution: Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D. Licensed CC BY 4.0; this application filters, aggregates, and maps the records to a simulated warehouse.

## Deploy

Live application: **https://my-new-idp-repo.vercel.app**. The verified human-team implementation is on [`feat/complete-warehouse-twin`](https://github.com/kishore-23MIC0100/my-new-idp-repo/tree/feat/complete-warehouse-twin). This release was deployed explicitly from that branch; existing independent work on `main` was preserved.

Vercel project: `i-dev1/my-new-idp-repo`. Use the repository root, Vite framework, `npm ci`, build command `npm run build`, and output directory `dist`. The application is static and needs no runtime credentials. After authenticating, link the existing project and run `vercel deploy --prod` from the tested checkout. Avoid selecting the separate upstream `warehouse-dashboard/` prototype as this application's root.

The prior private Sites project identity remains in `.openai/hosting.json` for provenance. Current Vercel release IDs and verification evidence are recorded in `DEV_LOG.md`. The local source archive and screenshots are additional handoff artifacts; the original workbook is kept outside Git.

## Limitations and next steps

The scene supports one to four articulated human workers, each assigned a different consecutive real order. A wave starts at the selected order; departures are three simulated seconds apart. The final wave uses only the remaining orders. Select a worker in the team strip or scene and use **Follow picker** for a close view. Start, pause, speed, reset and event stepping use one clock for all workers. The wave finishes after every worker returns to the dock.

Monthly KPIs remain aggregate worker distance/time across the entire dataset; they do not claim a concurrency speedup. The team strip separately shows elapsed wave time. Routes use a nearest-next-pick policy and do not model congestion, worker collisions, or vertical travel. Dock parking offsets and shelf-handling gestures are visual only. Batch picking, true drag-and-drop in the 3D scene, shared leaderboards, and measured warehouse calibration remain future work. Worker geometry and portraits are procedural project assets; no external character model is downloaded.

## Architecture and demonstration

Pure algorithms live in `src/engine/`, runtime data validation in `src/data/`, shared charts in `src/components/analytics/`, geometry in `src/components/warehouse/`, and the accessible editor in `src/components/layout/`. The React application coordinates immutable layouts and memoized scores. Original and baseline scores are reused during player edits. Rendering is demand-driven when playback is paused.

See [DEV_LOG](DEV_LOG.md), [architecture](docs/architecture.md), and [demo guide](docs/demo-guide.md). Older historical entries in `docs/development-log.md` describe earlier snapshots; the root log records the current corrective work. Official hackathon rules, team roster, submission portal, and an uploaded presentation/video are external deliverables that have not been verified or submitted.
## Team Member Details — NEXAI 2026

**Project:** NEXAI 2026 — Warehouse Digital Twin  
**Problem Statement / Track:** Track 4 · AI for Supply Chain & Logistics — Warehouse Digital Twin: 3D Picking Floor Game  
**Team Name:** VIT VELLORE  
**Team Leader:** Kishore S  
**College:** Vellore Institute of Technology (VIT), Vellore Campus

### Team Roster and Individual Deliverables

| S. No. | Team Member | Registration / College ID | Role and Deliverables |
|---|---|---|---|
| 1 | Kishore S | 23MIC0100 | **Team Leader — Core Development, Digital Twin Integration, and Deployment.** Responsible for overall architecture, React and TypeScript application integration, Three.js warehouse visualization, 3D picker movement, A* pathfinding, warehouse slotting logic, simulation clock, scoring integration, GitHub management, production deployment, and final project integration. |
| 2 | Edrina Daisy | 24BCI0210 | **Data Analytics, Simulation Validation, and User Experience.** Responsible for validating the processed UCI Online Retail II dataset, checking product and order statistics, evaluating original and optimized slotting results, verifying distance and time comparisons, testing analytics charts and rack heatmaps, validating Slotting Lab workflows, identifying UI/UX issues, and documenting test results and findings. |

### Individual Deliverables

#### 1. Kishore S — Team Leader

- **Application Architecture:** Integrate the React, Vite, and TypeScript modules into a working application.
- **3D Warehouse Environment:** Implement and validate warehouse geometry, rack placement, dock visualization, camera controls, and picker models.
- **Routing and Simulation:** Integrate obstacle-aware A* routing, picker movement, order replay, handling-time calculations, and return-to-dock behavior.
- **Slotting and Scoring:** Integrate product placement, baseline comparisons, layout editing, and consistent workload scoring.
- **Integration and Deployment:** Maintain the GitHub repository, resolve integration issues, run production builds, and deploy the verified application to Vercel.
- **Final Demonstration:** Coordinate the live demo, explain the system architecture, and present the technical implementation.

**Expected Output:** A functional, deployable Warehouse Digital Twin with integrated 3D visualization, routing, simulation, slotting, and scoring features.

#### 2. Edrina Daisy — Data Analytics and Validation

- **Dataset Validation:** Verify the processed November 2011 retail data, including the 100 selected products, 2,339 orders, and consistency of order and product-pick records.
- **Performance Evaluation:** Compare the original layout, automatic fast-mover baseline, and user-designed layouts using the same workload.
- **Analytics Validation:** Check KPI calculations, order-level charts, rack heatmaps, route-distance comparisons, and time estimates.
- **Functional Testing:** Test product moves, swaps, undo, reset, layout import/export, baseline application, and browser-local persistence.
- **Quality Assurance:** Record bugs, reproduce issues, verify fixes, and check that displayed metrics agree with simulation results.
- **Documentation and Presentation:** Prepare test evidence, summarize performance findings, and help explain the methodology, assumptions, and limitations during the hackathon demonstration.

**Expected Output:** A validated dataset and analytics workflow, documented test results, verified performance comparisons, and supporting evidence for the final demonstration.

### Collaboration and Shared Responsibilities

Both members will review major changes, test the integrated application, prepare the final presentation, and verify that the submitted repository and live deployment match the demonstrated version.

Kishore leads technical integration and deployment, while Edrina leads analytics validation, testing, and evidence preparation. Both members contribute to project reviews, issue resolution, and the final hackathon presentation.

### Declaration

These deliverables describe the team's division of responsibilities. The team roster and registration details should match the official NEXAI 2026 registration, and the listed contributions should accurately reflect the work completed by each member.
