# Demonstration guide

1. Open Digital Twin. Explain that the 2,339 orders and 14,042 picks come from the supplied November 2011 workbook. The original warehouse placement is a disclosed synthetic arrangement because UCI has no location field.
2. Choose one to four pickers. Show the distinct order IDs in the team strip. Select each worker, use Follow picker to inspect the human model, and press Start. Pause freezes every worker and the telemetry. Next event advances to the next departure, completed pick or dock return across the team. The wave ends only after all workers return. Explain that the Analytics time total is total worker time; the team strip shows elapsed wave time. Shelf access adds 0/6/12 seconds per pick at L1/L2/L3. These are uncalibrated equipment-access assumptions; collisions are outside the model.
3. Switch to Automatic baseline. Compare distance and estimated time using the unchanged workload. The baseline is a frequency heuristic, not an AI or optimality claim.
4. Open Layout Lab, choose a SKU and empty destination, apply the move, observe rescoring, then undo. Export the layout and import it again.
5. Open Analytics. Explain separate travel, base handling and shelf-access times, the return-inclusive chart, the spatial heatmap, and layer filtering. Export the scored results.
6. Open AI Automation. Choose order frequency or units, switch between the full month and recent seven days, inspect the dated ranking and weekly changes, then apply a proposal. Show its result as Player in Analytics and Undo in Layout Lab. Explain that this is observed activity and in-sample evaluation, not a trained forecast.
7. Show Settings for methodology, attribution and limitations. Explain that category names are inferred from descriptions.

For a recording, use a desktop viewport of at least 1280 × 850. The mobile layout retains navigation, playback and the editor, with telemetry below the viewport. Keep the source workbook outside the repository and record only product/order data, not customer records.

Before official submission, the project owner must supply and verify the team roster, permitted AI-tool disclosures, portal, deadline, presentation/video requirements and final sharing audience. Those administrative details are not inferable from the supplied brief.
