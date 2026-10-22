# Development Log — NEXAI 2026 Warehouse Digital Twin

This log records the main implementation decisions, alternatives, AI assistance, verification, and known limitations for the submitted project. It is not a claim that optional stretch goals have been completed.

## Problem and solution

PS 4.2 asks for a browser-based warehouse digital twin driven by a real month of order lines. The application processes UCI Online Retail II data, maps selected products into a designed warehouse, simulates aisle-following picks, and lets the player compare a changed layout with the same order workload and an automatic fast-mover baseline.

## Key design decisions

- **Dataset window:** Use November 2011 from the `Year 2010-2011` workbook sheet. Exclude cancelled invoices, missing invoice or timestamp values, non-product codes, and non-positive quantities. Select the 100 products with the highest eligible units ordered, aggregate repeated invoice/SKU lines, and export the resulting product and order records as JSON.
- **Frequency and pick definitions:** Product frequency is eligible units ordered. A pick event is one aggregated order/SKU line; quantity is retained and contributes to handling time and units handled.
- **Warehouse geometry:** Use a 30 × 20 grid with 1.5 m cells, six rack blocks, a packing dock, and 252 rack-face slots. The source dataset contains no physical warehouse locations, so the original layout is a disclosed synthetic lexical-SKU assignment.
- **Routing:** Use deterministic four-direction A* over traversable aisle cells. Rack cells are blocked, and each pick routes to a walkable rack-face access cell. Each order returns to the dock.
- **Scenario fairness:** Score Original, Automatic Baseline, and Player Layout against the same orders. The automatic baseline assigns high-frequency products to slots with low round-trip dock cost. The player layout is editable in Layout Lab.
- **Estimated time:** Use 1.2 m/s walking speed, 5 seconds per product line, and 1 second per handled unit. These are simulation assumptions, not observed warehouse labour measurements.
- **Replay and charts:** Drive the 3D route, progress panels, distance-by-order chart, and rack-visit heatmap from simulation events rather than decorative hardcoded metrics.
- **Scope:** The current model has one picker and no congestion. Multiple pickers with congestion, batch picking, and a shared leaderboard remain stretch goals; they are not represented as implemented features.

## Experiments and rejected approaches

- Rejected scoring a layout change against a newly generated workload: all layouts reuse the same processed order sequence so their differences are comparable.
- Rejected straight-line distance through racks: routes follow orthogonal traversable aisle cells and rack-face access points.
- Rejected presenting the original slot map as a real warehouse plan: Online Retail II has no slot-location data, so the original is identified as a synthetic neutral assignment.
- Kept the live 3D geometry and simulation-derived route overlay as the functional twin; a static screenshot alone would not demonstrate order replay or measured slotting changes.
- Kept speed, handling, and layout assumptions visible in project documentation so estimated times are not presented as measured warehouse performance.

## AI assistance and tooling

OpenAI Codex was used as a coding assistant for implementation, debugging, test updates, documentation, and visual refinement. The resulting code and claims were checked against the project, automated tests, build output, and the dataset-processing rules. Dependencies and AI-assisted implementation are disclosed for review; no private company data or scraped personal data is used.

## Verification and deployment

Last recorded full verification on 22 October 2026:

- `npm run check` — passed.
- `npm run test` — 19 tests passed.
- `npm run test:python` — 3 tests passed.
- `npm run audit` — zero vulnerabilities reported.
- `npm run build` — passed.
- Team-provided Vercel URL — `https://my-new-idp-repo.vercel.app`; checked with HTTP 200. Its JSON endpoint returned 100 products and 2,339 orders. The checked-in JSON currently contains 100 products and 2,341 orders, so the live deployment and repository asset need to be synchronized before final judging.

The repository includes Vercel configuration. Confirm that Git-based deployment is connected and that a fresh production deployment serves the checked-in dataset.

## Known limitations and next work

1. **Multi-picker scheduling and congestion:** Add picker identities, deterministic order assignment, parallel route timelines, and aisle conflict/wait handling. Keep order-to-picker assignment consistent across layouts for fair comparisons.
2. **Batch picking:** Group orders into trips under a declared cart-capacity rule, and score all layouts with the same batch policy.
3. **Leaderboard:** Save player-layout results; a shared leaderboard requires a backend and an explicit data-retention/privacy decision.
4. **Dataset-count consistency:** The supplied ZIP and current Vercel deployment show 2,339 exported orders, while the checked-in data shows 2,341. Rebuild from the chosen source workbook and make the JSON, README, dashboard, and demo agree before final submission.
5. **Submission details:** Replace the team placeholders in README with official names, roles, and team/student ID only when confirmed. Add the final demo, pitch deck, and public-post links when available.
