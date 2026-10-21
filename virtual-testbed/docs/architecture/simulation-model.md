# Simulation model — assumptions and limitations

Everything below is **synthetic**. It is good enough to demonstrate workflows, failure handling and SLA accounting; it is **not** an engineering model of any real network.

## Topology (seed)
- 19 locations, 19 PoPs/nodes, 5 fictional providers (Alpha…Echo, all "(DEMO)"), 8 fictional cable systems (`SIM-…`), 29 spans, ~87,100 km total.
- City coordinates are approximate public city-centre coordinates, used for marker placement and great-circle distance only. They are not landing-station or route coordinates.
- Span length = great-circle × 1.30 (subsea) or × 1.25 (terrestrial). Real routes differ.
- Capacities (10–100 Gbps) and prices (IDR per Gbps-month) are invented. They do not describe PRT/LTI or any operator.
- Designed constraints for demos: KDI–TTE and MDO–TTE are 10 Gbps bottlenecks (Scenario C); Jakarta–Ternate has a node-disjoint protection pair via Balikpapan/Manado; Bali–Tokyo and Kendari–Sydney necessarily cross several providers; Delta requires manual acceptance.

## Route computation
Yen's k-shortest loopless paths (k = 12) on a pruned graph (down/ineligible/insufficient-capacity spans removed), weight = latency, cost or a balanced sum (1 ms ≈ Rp 1 juta/Gbps-month — arbitrary). Protection = best segment-, SRLG- and intermediate-node-disjoint pair among the k candidates. Not modelled: wavelength assignment, optical reach/regeneration, multi-layer constraints, global optimisation across demands. A disjoint pair that exists outside the k candidates can be missed (Suurballe/Bhandari would be exact).

## Latency / jitter / loss (Mode A)
Per span: base latency = length × 0.0049 ms/km (fibre group index ≈ 1.47); base jitter = 0.05 ms + 0.00004 ms/km; base loss = 0.0001 % + 1e-7 %/km. Each tick draws seeded noise per (seed, span, tick) — order-independent, hence reproducible. Utilisation above 90 % adds queueing latency and loss. Faults add latency/loss or take spans down.
Per service: sum of span latencies + 0.05 ms per node; jitter = √Σjitter²; loss = 1 − Π(1 − pᵢ); throughput = bandwidth × diurnal demand (50–95 %) × (1 − loss).
OSNR, optical power, dispersion and wavelength behaviour are **not modelled**; optical channels exist only as an inventory list.

## Time
- Wall clock: orders, timeouts, provisioning delays (default 1 s per span — demo-scaled).
- Simulation clock: ticks of 60 s simulated time. Auto-tick every 5 s real time (configurable), or manual `+1/+10/+60`.
- Telemetry, alarms, incidents, SLA windows use ticks.

## Faults → consequences
| Fault | Effect |
|---|---|
| FIBER_CUT / PORT_DOWN | span DOWN (provider/network outage) |
| NODE_DOWN | node and every attached span DOWN |
| SCHEDULED_MAINTENANCE | span DOWN, classified as maintenance (excluded from availability) |
| HIGH_LATENCY / PACKET_LOSS | span DEGRADED, adds ms / % |
| CAPACITY_EXHAUSTION | remaining capacity reserved by a FAULT reservation; congestion loss |
| PROVIDER_API_TIMEOUT | mock Sonata calls and auto-acceptance for that provider time out |
| PROVISIONING_FAILURE | virtual provisioning fails for services crossing that provider |
| CUSTOMER_SIDE_OUTAGE | service DOWN, classified customer-side (excluded) |

Service reaction when its active path breaks: switch to an intact protection path (1+1, 50 ms simulated, counted as restoration); otherwise, if auto-reroute, reserve a new path and come up after `reroute_ticks` (default 2 ticks = 2 min simulated); otherwise stay DOWN. Reroutes revert to primary when it is repaired; protection is non-revertive unless configured. Alarms are reconciled from state every recompute; correlated faults injected together form one incident (OPEN → MITIGATED → RESOLVED).

## SLA accounting
Availability = (measured − excluded − provider outage) / (measured − excluded), excluded = maintenance + customer-side. Ticks without samples count as `noDataSeconds` (simulator downtime), not as outage. Breaches (latency/jitter/loss above profile) open/close per tick with duration and peak; DEGRADED time is reported separately and does not reduce availability. A protection switch's 50 ms is shorter than a tick and therefore does not appear in availability — a known granularity limit.

## Reproducibility
Same seed + same sequence of actions in ticks ⇒ identical telemetry, alarms and incidents (Scenario H test compares a full replay after reset). IDs and wall-clock timestamps differ between runs by design.
