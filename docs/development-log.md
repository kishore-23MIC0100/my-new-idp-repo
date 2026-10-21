# Development log

## Phase 1 — Foundation and repository setup

**Status:** Verified.

### Decisions

- Started from an empty workspace with a strict React + Vite + TypeScript scaffold.
- Kept the initial interface data-honest: it presents no completed run metrics or artificial order records.
- Used a lightweight CSS warehouse staging view so the future 3D viewport has a coherent, responsive home without implying that Three.js geometry or routing is complete.

### Files added

- Vite/TypeScript project configuration.
- `src/app/App.tsx` command-center shell.
- `src/styles/global.css` responsive visual system.
- README and this development log.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed (Phase 1 foundation test).

### Next phase

Implement a rerunnable, tested UCI Online Retail II preprocessing pipeline and generated schema-validated dataset before adding scoring or visual results.

## Phase 2 — Real-data preprocessing and validation

**Status:** Verified.

### Decisions

- Source: provided `online_retail_II.xlsx`, worksheet `Year 2010-2011`.
- Selected period: November 2011 (84,711 source order lines).
- Product eligibility: codes matching `^\\d{5}[A-Za-z]{0,2}$`, positive quantities, non-cancelled invoices, valid invoice and timestamp.
- Frequency metric: eligible units ordered.
- Browser export: top 100 products; only selected-product lines are retained in orders, with duplicate SKU lines aggregated per invoice.

### Actual processing result

- Rows read from the selected workbook sheet: 541,910.
- November 2011 rows: 84,711.
- Eligible lines: 83,215 after 1,076 cancellation, 137 non-positive quantity, and 283 invalid/non-product-code exclusions.
- Export: 100 products, 2,341 orders, 14,043 order items, and 266,506 handled units.

### Verification

- Regenerated `public/data/retail-2011-11.json` from the supplied workbook.
- Generated `docs/data-quality-report-2011-11.json`.
- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 1 frontend foundation test and 3 Python preprocessing tests.

## Phase 3 — Warehouse geometry and aisle-aware routing

**Status:** Verified.

### Decisions

- Created one TypeScript source of truth for a 30 × 20 warehouse grid, six rack blocks, packing dock, valid rack-face slots, and a 1.5 m cell edge.
- Defined 252 valid slots (left/right rack faces × three shelf levels), providing sufficient capacity for the 100 real products.
- Used deterministic four-direction A*; rack cells are non-traversable and distances derive solely from returned waypoints.
- Added cached route lookup and explicit `null` results for invalid, blocked, or unreachable endpoints.
- Added layout validation to prevent invalid slots, missing products, and duplicate slot assignments.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 5 frontend tests and 3 Python tests.
- Route tests prove orthogonal movement, blocked-rack avoidance, rack-face access, invalid-endpoint handling, and duplicate-slot rejection.

### Next phase

Build the deterministic simulation engine, fair per-layout scoring, and automatic fast-mover baseline on top of this shared geometry.

## Phase 4 — Deterministic simulation, fair scoring, and baseline

**Status:** Verified.

### Decisions

- Every layout uses the identical processed order sequence, dock, warehouse geometry, A* router, walking speed, and handling model.
- Each order uses a deterministic nearest-reachable-next-pick policy and returns to the dock after its final pick.
- Because the source data has no warehouse-position column, the original layout is a disclosed neutral synthetic layout: lexical product-code order mapped to stable slot order, independent of pick frequency.
- Travel is scored from the exact waypoint geometry. Handling is separately calculated as 5 seconds per product line plus 1 second per handled unit.
- The automatic baseline ranks products by actual eligible units ordered, ranks slots by deterministic dock round-trip cost, and assigns fast movers to low-cost slots.
- The engine retains per-pick routes and rack-visit counts for playback and heatmap features in later phases.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 11 frontend tests and 3 Python tests.
- The real November 2011 test scored all 2,341 exported orders in original, automatic, and player layouts using the same input set.

### Next phase

Add the 3D digital-twin viewport and make the animated picker consume the scored route-event sequence.

## Phase 5/6 — Automatic baseline and interactive 3D digital twin

**Status:** Verified for the implemented MVP scope.

### Delivered

- Added the frequency-aware baseline in the shared scoring engine. It maps high-frequency real products to lowest-cost reachable slots using deterministic ties.
- Added a Three.js / React Three Fiber viewport using the same warehouse dimensions, rack blocks, slot coordinates, and dock as the router.
- Added a visible worker marker, product bins, packing dock, racks, floor grid, orbit/pan/zoom controls, and WebGL fallback.
- Connected replay controls to the first exported order's actual simulation event sequence. The route overlay, target SKU, route length, handling seconds, and picker location derive from the scored event rather than an independent animation.
- Lazy-loaded the 3D renderer so Three.js does not inflate the initial application command-shell chunk.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 11 frontend tests and 3 Python tests.

### Next phase

Build the slotting editor and comparison analytics around the same validated layout and scoring state.

## Phase 7 — Product slotting game

**Status:** Verified.

### Delivered

- Added a searchable Layout Lab using all 100 real processed SKU records and source-backed pick-frequency values.
- Added product selection and valid-slot swapping. A slot always has one editable product, so a move is an atomic two-product swap rather than a duplicate or product loss.
- Added undo, reset to the documented original layout, session-local persistence, and apply-fast-mover-baseline actions.
- Recalculated route, travel, handling, and score metrics from the same 2,341-order input after every valid player-layout edit.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 13 frontend tests and 3 Python tests.
- New unit tests prove products remain unique and layout validation passes after a swap; an empty/non-editable destination is rejected.

### Next phase

Build the analytics view with original, automatic, and player comparison metrics plus a route-derived rack-visit heatmap.

## Phase 8 — Analytics and explainability

**Status:** Verified.

### Delivered

- Added a dedicated Analytics view with original, automatic-baseline, and current-player metrics calculated from the same real order stream.
- Displays total/average walking distance, total/average estimated time, completed orders, picks, units handled, and explicit signed distance reduction.
- Added a player-layout rack heatmap driven by `rackVisits` from actual scored pick events; it is not randomly generated.
- Documents the frequency-aware baseline and clearly separates estimated travel plus handling time from real-world measurement.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed: 13 frontend tests and 3 Python tests.
- Real-dataset test now verifies that summed rack visits equal the 14,043 simulated product picks.

### Next phase

Polish responsive behavior, add error-recovery safeguards, complete README guidance, and perform final end-to-end verification.

## Phase 9 — Reliability, documentation, and deployment readiness

**Status:** Verified.

### Delivered

- Added a guarded dataset-load retry path and recovery messaging for malformed session layout state.
- Added an error boundary around the lazy 3D scene so the remaining application stays usable if its renderer fails.
- Added Vercel SPA rewrite configuration.
- Rewrote README to document actual functionality, actual derived-data counts, fair scoring assumptions, local setup, checks, dataset regeneration, and deployment.
- Added layout restoration validation, navigation state cues, and a replay handoff from Analytics back to the live twin.

### Verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm run test` — passed.

### Remaining external work

- Deploy the committed repository to Vercel and test the live URL.
- Add project team, demo video, and competition submission links when supplied.
