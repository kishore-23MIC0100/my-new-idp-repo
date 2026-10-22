# Simulation and scoring methodology

## Fair input set

Original, automatic, and player layouts receive the identical exported November 2011 order sequence. They use the same warehouse grid, packing dock, walking speed, handling assumptions, and deterministic visit-order policy. The only allowed difference is product-to-slot assignment.

The source workbook does not contain physical warehouse positions. The original comparison layout is therefore a documented synthetic starting layout: selected product codes sorted lexically and assigned to slots in stable slot order. It intentionally does not reuse the input's frequency-ranked product order, so it does not pre-optimise the original layout.

## Visit-order policy

For each order, the picker starts at the packing dock. The simulation selects the reachable remaining product with the shortest A* route from the picker's current access cell. SKU code breaks ties. It records the exact route waypoint sequence for the pick, then returns to the dock after the order's final pick.

## Time assumptions

- Walking speed: 1.2 m/s.
- Handling time: 5 seconds for each product line plus 1 second for each handled unit.

Travel seconds equal route metres divided by walking speed. Estimated order time is travel seconds plus handling seconds. These are documented simulation assumptions, not real-world measurements.

## Automatic baseline

The baseline ranks products by eligible units ordered from the processed source data. It ranks valid slots by deterministic round-trip travel distance from the packing dock. It assigns high-frequency products to low-cost reachable slots, preserving one product per valid slot. This is a frequency-aware heuristic, not an AI model.

## Metrics

The engine reports total and average walking distance, travel seconds, handling seconds, estimated total and average order time, completed orders, product picks, units handled, pick-event routes, and actual rack visit counts. Percentage reduction uses:

`((original - candidate) / original) × 100`

A negative result means the candidate is worse. A zero original denominator returns an unavailable percentage rather than a misleading value.

## Replay and reconciliation

`events` contains product picks only and is the source for rack visits. `timeline` includes those same picks plus an explicit return-to-dock event for every order. `perOrder` includes all walking and handling. Summing its distances equals the headline distance; summing timeline segment lengths gives the same total. Tests assert both invariants against the actual dataset.

The playback clock accumulates simulated seconds. Walking interpolates the actual scored waypoints at 1.2 m/s, then stays at the rack face during handling. A pick completes only after handling. Pause freezes elapsed time, and changing playback speed affects future clock increments only. The picker returns to the dock before an order is marked complete. Choosing another order restarts at its dock; orders can be selected individually.

The baseline retains monthly eligible units as its declared frequency measure. This differs from invoice occurrence frequency; both definitions are valid modelling choices, but this application never substitutes one silently. Shelf access points at all three levels share horizontal travel cost. Estimated time is not a field measured in Retail II.
