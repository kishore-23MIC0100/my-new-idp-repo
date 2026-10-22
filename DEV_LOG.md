# Development log

## 2026-10-22 — Data and simulation audit

Repository: `kishore-23MIC0100/my-new-idp-repo`, cloned into `D:\nexai-warehouse`.
Starting commit: `5fcb8da2e69fda124e3c1d24c9a221f39ac43140`; clean working tree.
Working branch: `feat/complete-warehouse-twin`. Remote read access verified by `git ls-remote` and clone. The separate CogniConnect checkout and its pre-existing deletions were not modified.

Inspection found a static image substituted for warehouse geometry, independently timed picker animation, missing return events in playback/chart data, an editor limited to 12 products/30 occupied slots, a hardcoded macOS Python path, and incomplete runtime validation.

Data fixes: one order per invoice even if its timestamps differ; chronological order after grouping; missing timestamps counted before month filtering; finite positive quantities; missing-description fallback; deterministic metadata and SHA-256 workbook provenance; documented UK wall-time timestamps. The supplied workbook was processed with `python scripts/process_retail_data.py D:\spm\game\online_retail_II.xlsx` using pandas 2.3.1/openpyxl 3.1.5. Output is 100 products, 2,339 invoices, 14,042 picks, 266,506 units. Earlier 2,341/14,043 counts split two invoices by timestamp. Counts and source hash are in the quality report.

Engine fixes: explicit return timeline, per-order distance/time reconciliation, finite inputs, integer grid coordinates, validated moves to empty slots and occupied-slot swaps, shared elapsed-time playback with handling pauses and dock return. Browser data validation checks chronology and referential integrity.

Checks actually run: `npx tsc -b` passed; `npm test` passed 20 tests across 6 files; `python -m unittest discover -s tests` passed 6 tests. Real Git diff reviewed for data and engine changes. Further UI/browser checks follow in the next increment.

UCI attribution/license verified at https://archive.ics.uci.edu/dataset/502/online+retail+ii (CC BY 4.0). Official hackathon submission rules, team identity, and submission deadline were not supplied or verified.

## 2026-10-22 — Complete interactive application

Core data/engine commit: `8f7f332134b94d45d70be6711ae8fe1c9faa9785`.

Replaced the static warehouse overlay with genuine geometry. All six racks, cartons, aisle labels, trucks, equipment, picker, cyan route and magenta target use the shared warehouse definition. Cartons are instanced and idle rendering is demand-driven. Labels use generated canvas textures, eliminating remote font dependencies. The initial camera and dashboard composition were reviewed against screenshots.

Rebuilt the sidebar, six real KPI cards, three telemetry panels and three bottom panels around the supplied reference. Search and inferred category filters, all layers, camera modes, playback speed, order selection, pause/resume/reset/step are connected. Comparison charts use return-inclusive per-order distances, and the heatmap uses spatial rack segments and actual filtered pick events. The displayed distance reduction is explicitly defined instead of inventing an optimal-route efficiency score.

Layout Lab exposes all products and slots with valid moves/swaps, undo, original reset, baseline application, local persistence, import/export and immediate rescoring. Analytics separates travel and handling and can export metrics/per-order results. Added data-load recovery and method/attribution details.

Fixed the macOS-only test command, pinned the application dependencies, added compatible TypeScript/ESLint tooling, Playwright tests, HTML metadata, responsive controls and architecture/demo documentation. TypeScript 7 in the original lockfile conflicted with typescript-eslint's supported range; TypeScript 5.9.3 resolved it without ignoring peer constraints. `npm audit` during installation reported zero vulnerabilities. Replaced the tautological foundation test with actual data and playback coverage.

Verification on the final source: `npm run verify` passed TypeScript, ESLint, 20 Vitest tests and 6 Python tests. `npm run build` passed; Vite reports expected large-bundle warnings for the lazy Three.js scene (~957 kB minified, ~255 kB gzip) and main bundle (~633 kB minified, ~190 kB gzip). No build failure was suppressed. `git diff --check` passed.

Browser connection discovery returned no available connected browser. Local Playwright Chromium was therefore used. Earlier runs found continuous rendering overload and label-root problems, which were corrected with demand rendering and 3D texture labels. Later failures were test whitespace assumptions and a race with elapsed playback; assertions now compare specific values and reset the clock before stepping. Playback/scenario/error-recovery flows passed. The final full browser run is recorded below when complete.

Local production preview requested by the user is running at http://127.0.0.1:4174 (HTTP 200 checked). Test preview uses a separate port 4173 and stops automatically. A private Sites project was registered as `appgprj_6ad90ecb2b288191a9542a003a95a4a0`; registration is not yet deployment evidence. GitHub origin and its branch history remain intact; no GitHub push has been performed.
