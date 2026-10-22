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

## Final browser verification

Application commit: `66bed00` (verified with `git log`). `node node_modules\@playwright\test\cli.js test` passed all 3 browser tests in 2.6 minutes against the final production build. Coverage: real dataset counts; WebGL canvas; start/pause and stable paused telemetry; reset/event stepping; complete dock return; layer filtering; original/baseline switching; analytics; all 100 products and 252 destination slots; movement/undo; baseline application; layout restoration after reload; 390 px mobile controls without horizontal overflow; malformed-data retry. No page errors occurred in the playback test.

Visually reviewed `artifacts/dashboard-desktop.png` (1440 × 960) and `artifacts/dashboard-mobile.png` (390 × 2153). The reference panel composition and palette are retained. The warehouse is a stylized interactive 3D model, not the photographic rendering in the supplied reference. Browser tests run on software WebGL here; target-device GPU performance has not been benchmarked. No static warehouse image is used by the runtime.

Final dataset scores observed in the rendered application: original walking 196.11 km, frequency baseline 175.99 km (10.3% reduction), same 2,339 invoices/14,042 picks/266,506 units. Original estimated time 8,335.7 min; baseline 8,056.2 min. These totals include handling all retained units and are simulation estimates.

## Private publication

The Sites source helper verified push and packaged commit `33e8626ef2bd5647b74c35f39a615ef958d4fee3`. Native private deployment `appgdep_6ad95eb6caa08191808f06a938859ee1` returned `succeeded` with no failure message.

Live URL: https://my-new-idp-repo.vercel.app/

Saved version: `appgprj_6ad90ecb2b288191a9542a003a95a4a0~appgver_6c40c99cded081919a2d3efd950a55d7`. Audience remains owner-private. Deployment archive: `D:\nexai-deliverables\warehouse-site.tar.gz`. The first packaging attempt hit a Windows root-directory mkdir error; using an existing output subdirectory resolved it. The source credential was renewed when its original short-lived authorization expired. No credentials were written to the repository.

This final log-only commit records publication after it happened; application/build sources are identical to the deployed commit. GitHub was not pushed or merged. Official competition submission, team roster and uploaded demo/video are not completed because the required owner-specific information was not provided. Optional batch picking, multiple pickers and congestion remain outside the implemented single-picker model.

## Human picker team and Vercel preparation (2026-10-22)

Requested follow-up: recognizable human picker, multiple workers, verified operation, GitHub push and Vercel hosting. This entry supersedes the earlier single-picker scope and publication destination for this revision. Work is AI-assisted and recorded in actual Git commits; no backdated progress or official submission is claimed.

Implemented procedural articulated workers with faces, hard hats, reflective vests, limbs, gloves and boots. Walking and picking poses use the shared scored clock. A human SVG portrait replaces the pawn glyph. Team size is one to four, default three. Distinct consecutive dataset orders form a wave; departures are staggered by three simulated seconds. Selecting a worker updates the route, follow camera, portrait, order progress and telemetry. Event stepping considers the whole wave; completion waits for every dock return. A truncated final wave cannot duplicate orders.

Monthly KPI totals still represent the full workload's aggregate worker effort. Wave elapsed time is separate. No congestion/collision avoidance, vertical reach cost, or measured throughput improvement is claimed. Dock parking offsets and handling gestures are display-only. These assumptions are exposed in Settings and README.

Validation so far: TypeScript, ESLint, 24 Vitest tests and six Python tests passed; production build passed. New tests cover unique order assignment, sum of worker durations/distances, shared-clock pause, departure offsets, heading at shelves, completion and final-wave boundaries. Browser tests additionally exercise human selection/follow, multi-worker controls and real layout export/import, including a rejected invalid assignment. Browser result will be recorded after completion. Vite reports large chunks (3D dependency bundle); target GPU performance is not benchmarked here.

GitHub main has newer independent commits, including warehouse-dashboard/. They are preserved. This implementation will be published on feat/complete-warehouse-twin without rewriting main. Vercel CLI 65.0.0 reports logged out; device login has been offered to the owner. Credentials are excluded from source. vercel.json explicitly configures Vite, npm ci, npm run build and dist. The requested deployment destination is now Vercel; the prior private Sites deployment is a historical version.

Final verification for this revision: all four Playwright browser tests passed in 4.7 minutes. Screenshot inspection found a dock sign obscuring the human models; the sign is now a floor decal and idle workers face forward. TypeScript, ESLint and production build passed after that visual fix, and the human-team browser test passed again (1.4 minutes including server startup). Reviewed the updated close-up: three distinct human workers are visible from head to boots. Reviewed the 390 px mobile capture; no horizontal overflow was detected by the browser test.

The owner completed GitHub and Vercel device authentication. The local checkout is linked to the existing i-dev1/my-new-idp-repo Vercel project, production alias https://my-new-idp-repo.vercel.app. The Vercel login helper wrote an ignored local environment file; it is excluded from both Git and deployment upload. No token values were inspected or committed. Deployment and remote push results are recorded separately after completion.

## Verified GitHub and Vercel release

Application commit: `8789f7121ba75cc047804c916c8588a7bcc17c4b`. Successfully pushed to `origin/feat/complete-warehouse-twin`; `git ls-remote` confirmed the same SHA. GitHub Actions run https://github.com/kishore-23MIC0100/my-new-idp-repo/actions/runs/39713716416 finished with **success**, including dependency installation, TypeScript, lint, 24 JavaScript tests, six Python tests, production build, Chromium installation, and all four browser tests on Ubuntu.

Production: https://my-new-idp-repo.vercel.app. Vercel source deployment `dpl_E8KJmnADSk5K9xi9xiaWxDuG98XQ` reached READY after npm ci took about five minutes. During the registry delay a prebuilt fallback was prepared from the locally tested dist; all six copied files were checked by SHA-256. The attempt to cancel the first deployment returned 400 because it had already completed. The fallback deployment `dpl_EtmxN1ddMvKoH7qZayi9Y9HRDYko` also reached READY and now owns the production alias. Both builds have matching application asset names. The CLI's npm update-check warning did not prevent either deployment.

An unauthenticated Chromium smoke check against the public production alias passed: HTTP 200, 2,339 real orders, default three-worker team, human close-up, four-worker selection, and event stepping, with zero page errors. Reviewed `artifacts/vercel-production.png`. Existing Vercel audience/settings were retained. The browser tests and screenshot review are evidence of tested flows, not a claim that every device or edge case has been exhaustively tested.

Handoff: `D:/nexai-deliverables/nexai-warehouse-source.zip` contains the tracked source. The local preview remains available at http://127.0.0.1:4174. This follow-up documentation commit does not alter the verified application or deployment assets. Its CI skip marker avoids repeating the already-successful workflow for documentation alone. Main was not rewritten or merged; official competition portal submission remains the owner's separate administrative step.

## Dedicated tabs, observed automation and shelf access (2026-10-22)

Engine commit: `e695cef`. This revision supersedes the earlier dashboard composition, zero shelf-access assumption and baseline scores. Digital Twin now contains the human picker team, 3D floor, playback controls and current-order telemetry. Layout Lab contains manual editing; Analytics owns the comparison, distance chart and heatmap; AI Automation owns observed-activity ranking and proposal application. Removed the duplicated KPI/bottom panels and enlarged text, controls and spacing. Product search is expandable to keep playback controls accessible. The camera fits the floor to the available viewport, including narrow screens.

Automation ranks all products by either distinct order occurrences or units, over the complete dataset or its final seven calendar days. It shows the latest and preceding seven-day counts and proposes slots ranked by round-trip dock walking time plus shelf access. Zero-activity products retain valid unique assignments. Proposals can be applied, edited, undone and exported. Metric/window choices survive tab navigation. This is an observed-frequency heuristic using one month of history, not a trained demand or seasonal forecast. Replay uses the same complete workload and is explicitly an in-sample comparison.

L1/L2/L3 add 0/6/12 seconds per invoice/SKU pick, independently of quantity. These are illustrative equipment-positioning/retrieval assumptions, not measured climbing times. Playback waits during access; slot ranking includes the cost. Analytics and result exports separate travel, base handling and shelf access without double counting. Continuous vertical motion and worker collisions remain outside the model.

Current original totals: 196.11 km walking and 9,821.6 estimated worker-minutes, including 1,485.9 shelf-access minutes. The cost-aware monthly-unit baseline is 186.70 km and 9,284.9 minutes, reductions of 4.8% and 5.5%. Both replay the same 2,339 orders, 14,042 picks and 266,506 units. These are simulation results, not measured warehouse productivity.

Validation: `npm run verify` passed TypeScript, ESLint, 30 Vitest tests and six Python tests. Production build passed. All six Playwright scenarios passed, covering playback, human teams, manual editing/import/export/persistence, malformed-data recovery, automation/application/export reconciliation, and mobile tab separation. Following the final camera, expandable search and persistent automation-control refinements, TypeScript, lint and build passed again; the three affected browser scenarios passed again in 2.5 minutes. Reviewed desktop, mobile, automation and analytics captures. Vite's existing large-chunk warning remains; target-device GPU performance has not been benchmarked. Git diff was reviewed before the engine and interface commits. Publication results will be recorded after verification.
