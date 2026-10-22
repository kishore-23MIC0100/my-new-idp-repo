# Architecture

The static React/Vite app downloads a preprocessed, validated JSON asset. No backend, database, credentials or paid APIs are needed at runtime.

1. `scripts/process_retail_data.py` cleans the provided workbook using pandas/openpyxl, consolidates invoices, ranks 100 products, validates records and emits the browser dataset and quality report.
2. `src/data/dataset.ts` verifies the browser contract before any dataset is marked loaded. Category labels are display-only keyword rules.
3. `src/engine/warehouse.ts` owns the 30 × 20 grid, rack obstacles, dock, access points, slots and cached deterministic A* paths.
4. `src/engine/simulation.ts` validates the layout and workload, applies nearest-next-pick routing, creates pick and return events, and aggregates distance, travel, handling, units and rack visits. The frequency baseline is scored by this exact engine.
5. `src/engine/playback.ts` maps simulated elapsed time to one event, one interpolated coordinate, completed picks and travelled distance. React controls the clock; the Three.js scene does not independently advance it.
6. `App.tsx` owns the active scenario, order, clock, selection and undo history. Scores are memoized by immutable layouts. Valid edits are immediately rescored and autosaved when browser storage is available. Invalid imported assignments are rejected before mutation.
7. `DigitalTwin.tsx` builds genuine racks, cartons, floor, equipment, picker, labels and active routes in 3D. It reads the warehouse definition, uses demand rendering, and is lazy-loaded inside a renderer error boundary.
8. Shared chart components consume `perOrder` and `events`; no random heat or hardcoded chart data is generated.

Recovery: bad data presents Retry. Storage failure leaves a usable in-memory editor and export. A renderer failure preserves Layout Lab and Analytics. The layout form is the keyboard-accessible alternative to pointing at 3D objects.

Scope boundaries: no shared accounts/leaderboard, stock replenishment, collision model, batch routes, vertical time, or real-time warehouse integration. All remain explicit future extensions rather than implicit simulation claims.
