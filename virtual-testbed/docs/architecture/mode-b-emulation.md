# Mode B — optional packet/optical emulation (evaluation, not implemented)

Status: **NOT AVAILABLE / NOT CONNECTED.** `ContainerlabAdapter` and `MininetOpticalAdapter` only detect whether the tool binary exists and report it; every operation throws `ADAPTER_NOT_AVAILABLE`. Mode A is complete without them.

The statements below are from general knowledge of these projects and **need verification against their current documentation** before any work starts (versions, licences and requirements change).

| | Containerlab | Mininet-Optical |
|---|---|---|
| What it gives | Container-based virtual routers/switches wired into topologies (real control planes, e.g. vendor NOS images or FRR) | Mininet extension with a simplified optical layer (ROADMs, amplifiers, OSNR estimates) for SDN/optical research |
| Host needs (to verify) | Linux, a container runtime, root/sudo; vendor images may need licences and significant RAM | Linux, Mininet + Open vSwitch, root; Python environment |
| Fits shared cPanel? | No | No |
| Value for this testbed | Real packet forwarding, real `ping`/iperf for activation tests | More credible optical impairment numbers than Mode A |
| Main risk | Resource cost; image licensing | Research-grade model; results still not "engineering accurate" |

## Integration plan (gated)
1. Run on an isolated lab VM, never on production networks.
2. Implement the existing `NetworkSimulationAdapter` interface — no marketplace/order changes needed.
3. Map seed topology → Containerlab topology file / Mininet script; map services → VLAN/VRF or lightpath configs.
4. Replace synthetic activation tests with measured ones; keep the `SIMULATED`/`EMULATED` label distinct from real measurements.
5. Contract tests: the same Scenario A–H suite must pass with the Mode B adapter.
