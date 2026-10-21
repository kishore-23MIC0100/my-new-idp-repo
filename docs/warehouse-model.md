# Warehouse model and route policy

## Geometry

The Phase 3 warehouse is a 30 × 20 orthogonal grid. Each grid edge equals 1.5 metres. The packing dock and picker start are at cell `(2, 17)`.

Six rack blocks occupy two adjacent grid columns each, across rows 3–16. Those cells are obstacles. All other in-bounds cells are traversable aisles. This makes the visible storage geometry and route model share one source of truth instead of allowing paths through shelving.

Each rack row provides left and right face access cells at three vertical levels. The model creates 252 valid physical slots, more than the 100 processed products required for the MVP.

## Routing

`findShortestRoute` uses deterministic A* over four cardinal neighbours. Diagonal movement is not allowed. Stable x/y tie-breaking makes equivalent inputs reproduce the same waypoint sequence. Distances are calculated as `(waypoint edges × 1.5 m)`.

Products are associated with a storage position but routes terminate at the adjacent aisle access cell. An inaccessible, invalid, or rack-cell endpoint returns an explicit `null` route. Route caching is internal to fixed geometry and can be cleared when geometry changes.

## Layout integrity

The initial layout maps products to valid slots in stable product order. Validation requires every expected product exactly once, a valid slot for every assignment, and no duplicate occupied slots.

## Current limitation

This is the routing foundation only. Order sequencing, return-to-dock policy, picking time, and score comparison are Phase 4 work. No walking metric in the interface currently represents a completed simulation.
