# Architecture

The static React/Vite app downloads a preprocessed, validated JSON asset. No backend, database, credentials or paid APIs are needed at runtime.

1. `scripts/process_retail_data.py` cleans the provided workbook using pandas/openpyxl, consolidates invoices, ranks 100 products, validates records and emits the browser dataset and quality report.
2. `src/data/dataset.ts` verifies the browser contract before any dataset is marked loaded. Category labels are display-only keyword rules.
3. `src/engine/warehouse.ts` owns the 30 × 20 grid, rack obstacles, dock, access points, slots and cached deterministic A* paths.
4. `src/engine/simulation.ts` validates the layout and workload, applies nearest-next-pick routing, creates pick and return events, and aggregates distance, travel, base handling, shelf-access time, units and rack visits. The frequency baseline is scored by this exact engine.
5. `src/engine/playback.ts` maps simulated elapsed time to an event, interpolated coordinate, heading, handling time, completed picks and travelled distance. `team.ts` assigns distinct consecutive orders to up to four workers with staggered departures. The wave ends at the maximum worker finish time. React controls the shared clock; neither joint animation nor the Three.js scene independently advances it.
6. `App.tsx` owns the active scenario, order, clock, selection and undo history. Scores are memoized by immutable layouts. Valid edits are immediately rescored and autosaved when browser storage is available. Invalid imported assignments are rejected before mutation.
7. `DigitalTwin.tsx` builds genuine racks, cartons, floor, equipment, workers, labels and the selected worker's route in 3D. `HumanPicker.tsx` supplies articulated human geometry, protective clothing, facial features and a portrait. Walking, facing and handling poses derive from playback state. The follow camera tracks the selected worker. The scene reads the warehouse definition, uses demand rendering, and is lazy-loaded inside a renderer error boundary.
8. Shared chart components consume `perOrder` and `events`; no random heat or hardcoded chart data is generated.

Recovery: bad data presents Retry. Storage failure leaves a usable in-memory editor and export. A renderer failure preserves Layout Lab and Analytics. The layout form is the keyboard-accessible alternative to pointing at 3D objects.

Scope boundaries: no shared accounts/leaderboard, stock replenishment, collision model, batch routes, calibrated retrieval equipment, or real-time warehouse integration. All remain explicit future extensions rather than implicit simulation claims.

`TeamActivity.tsx` fills the space below the floor with a current-wave event feed. Its timestamps include worker departure offsets, travel, base handling and shelf access from the scored timelines. It initially shows planned completions, then the latest four completed picks/returns and the next completion. The shared clock makes pause, reset and scenario changes consistent with the 3D replay. Selecting an entry selects its picker and product.

The four tabs mount only their relevant view. The 3D scene and replay controls are confined to Digital Twin; comparison tables, line chart and heatmap appear only in Analytics. Automation is implemented in `engine/automation.ts` and `components/automation/AutomationView.tsx`; it consumes the same validated orders, ranks observed activity and previews with the shared engine. Shelf-access time lives in each scored event and drives both the access-phase label and worker waiting pose.
