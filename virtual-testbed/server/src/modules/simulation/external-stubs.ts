import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AdapterStatus, NetworkSimulationAdapter } from './adapter.js';
import { SimulationError } from './adapter.js';

const exec = promisify(execFile);

async function hasBinary(bin: string): Promise<boolean> {
  try {
    await exec('which', [bin], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mode B placeholders. They only DETECT whether the external tool is present
 * and report why it cannot be used. They do not create containers, namespaces
 * or Mininet topologies. See docs/architecture/mode-b-emulation.md for the
 * evaluation (requirements, privileges, integration gates).
 */
abstract class UnavailableAdapter implements NetworkSimulationAdapter {
  abstract status(): Promise<AdapterStatus>;
  private fail(): never {
    throw new SimulationError('ADAPTER_NOT_AVAILABLE', `${this.constructor.name} is an optional Mode B stub and is not implemented/connected in this phase.`);
  }
  createVirtualService(): Promise<never> { return Promise.resolve(this.fail()); }
  activateService(): Promise<never> { return Promise.resolve(this.fail()); }
  deactivateService(): Promise<never> { return Promise.resolve(this.fail()); }
  getServiceStatus(): Promise<never> { return Promise.resolve(this.fail()); }
  runConnectivityTest(): Promise<never> { return Promise.resolve(this.fail()); }
  readMetrics(): Promise<never> { return Promise.resolve(this.fail()); }
  injectFault(): Promise<never> { return Promise.resolve(this.fail()); }
  restoreFault(): Promise<never> { return Promise.resolve(this.fail()); }
  resetScenario(): Promise<never> { return Promise.resolve(this.fail()); }
}

export class ContainerlabAdapter extends UnavailableAdapter {
  async status(): Promise<AdapterStatus> {
    const found = await hasBinary('containerlab');
    return {
      name: 'Containerlab (container-based virtual routers)',
      mode: 'CONTAINERLAB',
      available: false,
      label: 'NOT AVAILABLE',
      detail: found
        ? 'containerlab binary detected, but the adapter is a stub: integration is gated (see docs). Requires Linux, a container runtime and root/sudo.'
        : 'containerlab not installed. Optional; Mode A runs without it.',
    };
  }
}

export class MininetOpticalAdapter extends UnavailableAdapter {
  async status(): Promise<AdapterStatus> {
    const found = (await hasBinary('mn')) || (await hasBinary('mininet'));
    return {
      name: 'Mininet-Optical (packet-optical emulation)',
      mode: 'MININET_OPTICAL',
      available: false,
      label: 'NOT AVAILABLE',
      detail: found
        ? 'Mininet detected, but the Mininet-Optical adapter is a stub: integration is gated (see docs). Requires Linux and root privileges.'
        : 'Mininet / Mininet-Optical not installed. Optional; Mode A runs without it.',
    };
  }
}
