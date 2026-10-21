# Roadmap: simulation → isolated lab → real network (with gates)

Nothing in this repository may connect to a production network, provider API, payment gateway or billing system. Moving forward requires passing each gate, with written sign-off.

| Stage | Scope | Exit gate (all must hold) |
|---|---|---|
| **S0 — Digital twin (this build)** | Mode A simulator, mock Sonata, simulated payment/ledger | Scenario A–H + unit/contract/e2e green; demo signed off by Commercial + NOC; stakeholders acknowledge every number is synthetic |
| **S1 — Real spec conformance (offline)** | Replace illustrative Sonata contract with the official SDK schemas | SDK YAML in repo (licence permitting); generated types; contract tests validate mapper output against `productOrderManagement.api.yaml` v11.0.1; operationIds camelCase (NFR-012); decision log for each unmapped field |
| **S2 — Isolated lab** | Mode B adapter (Containerlab/Mininet-Optical) on a lab VM; sandbox Sonata endpoint from a partner, if offered | Lab network physically/logically isolated; egress allow-list lists only sandbox hosts; credentials in a secret store, not env files in repo; security review of the adapter; Scenario suite green on Mode B |
| **S3 — Pilot with one partner (read-mostly)** | Quote/serviceability calls to one partner sandbox → production read-only | Signed data-sharing/NDA; OAuth2 client_credentials with real token URL (the SDK value is a placeholder); rate limits agreed; rollback plan; audit retention policy; DPIA if personal data |
| **S4 — Production ordering** | Real orders, real settlement | Commercial basis for platform fee agreed and reflected in config; tax treatment confirmed by finance; billing system of record chosen (PRD OQ8); SLA wording approved by legal; incident/RTO process tested; independent pen-test |

## What is mock vs real today

| Capability | Status |
|---|---|
| Marketplace, quote, order state machine | Real logic, synthetic data |
| Capacity reservation (transactional, no overbooking) | Real logic, tested on PostgreSQL 16 |
| Orchestration, retries, timeouts, compensation | Real logic, simulated provider/network calls |
| Sonata adapter | **MOCK** (illustrative contract); real adapter **NOT CONNECTED** by construction |
| Network provisioning / tests / telemetry | **SIMULATED** (Mode A); Mode B **NOT AVAILABLE** |
| Payment / invoice / settlement | **SIMULATED** flags and ledger only |

## PRD v1.0 observations relevant to implementation (for the product owner)

These were noticed while reading the PRD against the REA notes; they need resolution before S1/S3, not in this testbed.
1. **Token lifetime contradiction**: FR-006 says client-credentials token lifetime 1 h; FR-010 says `expires_in: 604800` (7 days) for customers. Long-lived bearer tokens for machine clients weaken revocation. Recommend short access tokens + refresh/re-issue.
2. **Charge flow direction**: PRD §9.3 says "Seller request via PATCH /charge/{id}". The REA notes list `patchCharge` as "Respond to Charge", i.e. the **Buyer** responds to a Seller-created charge. Verify against the spec before designing the UI.
3. **Spec identifier inconsistency**: FR-001 cites "Cantata W677 v11.0.1", §9.1 cites "W679". One is wrong.
4. **Billing is read-only for the Buyer** (REA, high confidence): any C-Ring "create invoice" API would be a platform-internal API, not a Sonata one.
5. KPI targets (50/150 partners, 50K MCP calls) and ecosystem claims are targets/public-research claims, not verified facts; treat them as hypotheses.
