# Demo walkthrough (≈15 minutes)

Order → provisioning → active service → SLA breach → recovery. Start from a clean state: log in as `admin@demo.local` → Simulation Lab → **Full demo reset**.

## 1. Customer orders a protected service (Customer A)
1. Log in `customer.a@demo.local`. Note the SIMULATION banner.
2. **Marketplace**: A = Jakarta, B = Ternate, 1000 Mbps, EPL, *Domestic Premium*, **1+1 protected** → *Search routes*.
   - Show: primary JKT–MKS–KDI–TTE vs protection JKT–SBY–BPN–MDO–TTE (node-disjoint), latency vs 30 ms SLA, providers Alpha + Bravo, price breakdown with the **10 % DEMO platform fee**.
3. *Request quote* → *Accept quote* → order page → *Pay (SIMULATED)*.
4. Watch the stepper move: CONFIRMED → PROVIDER ACCEPTANCE (auto-accept after ~2 s) → RESOURCE RESERVED → PROVISIONING → TESTING → ACTIVE (≈10–15 s).
5. Open **Service → Activation tests**: reachability, expected path, bandwidth profile, latency, loss, protection path, reservation consistency — all PASS, all labelled SIMULATED.

## 2. Show capacity limits (optional)
Marketplace: Jakarta–Ternate **20000 Mbps** → *Search*: "INSUFFICIENT_CAPACITY … 10000 Mbps" with a one-click alternative.

## 3. Cable-owner view
Log in `delta@demo.local` (manual acceptance). As Customer B order Kendari–Sydney 1 Gbps (*Regional Standard*), pay; Delta sees it in **Cable Owners → Sub-order inbox** and can Accept/Reject/Clarify. Rejecting rolls the order back (REJECTED, capacity released, simulated refund).

## 4. NOC: fiber cut with protection
1. Log in `noc@demo.local`. **Simulation Lab** → *Pause auto-tick* (for a controlled demo).
2. Run **Fiber cut Jakarta–Makassar** → *Open incident*.
   - Timeline: FAULT INJECTED → PROTECTION SWITCH (50 ms) → ALARMS (LOS critical, ON_PROTECTION major) → MITIGATED.
3. **Network Topology** → *Show service path* → the cut span is red ✕, traffic on the purple protection path. Use the *Indonesia* zoom.

## 5. SLA breach and recovery
1. As Customer A, also order Jakarta–Makassar 1 Gbps (*Domestic Premium*, unprotected).
2. NOC → Simulation Lab → run **Latency above SLA Jakarta–Makassar** → *+10* ticks.
3. **SLA & Monitoring**: service DEGRADED, open LATENCY breach; the service's latency chart crosses the red SLA line; alarm `SLA_BREACH_LATENCY`.
4. Restore the fault → *+10* → breach closed with duration; availability stays 100 % (degraded ≠ unavailable).

## 6. Unprotected reroute and repeatability
- Run **Correlated failures — Sulawesi event** → unprotected services go DOWN, reroute starts, restored after 2 ticks; incident shows restoration seconds.
- *Restore all faults* → *Reset simulation* → re-run the same steps: identical numbers (seeded).

## 7. Money and audit
- Log in `commercial@demo.local` → **Revenue & Settlement**: charges = allocations + fees ("Ledger balanced: Yes"); mark an order settled (simulated).
- `auditor@demo.local` → **Audit Logs**: every action, including denied attempts, with request ids.
