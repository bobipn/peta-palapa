/**
 * Route computation engine (pure, no I/O).
 *
 * MVP algorithm — NOT carrier-grade path computation:
 *  1. Prune the graph: drop segments/nodes that are down, ineligible, excluded,
 *     or lack the requested free capacity.
 *  2. Yen's k-shortest loopless paths (Dijkstra inner loop) on a scalar weight
 *     chosen by objective (latency / cost / balanced).
 *  3. For protection, pick the best pair among the k candidates that is
 *     segment-, SRLG- and intermediate-node-disjoint. Because pairs are only
 *     searched inside the k candidates, a disjoint pair can be missed in
 *     "trap" topologies; Suurballe/Bhandari would be exact. Documented limitation.
 *  4. If nothing is feasible, progressively relax constraints to explain WHY
 *     (no path / node down / provider ineligible / capacity / SLA latency) and
 *     report the widest-path bottleneck so the caller can offer an alternative.
 *
 * Not modelled: per-wavelength assignment, optical impairments (OSNR, power),
 * shared-risk beyond explicit SRLG tags, multi-layer constraints, policy beyond
 * provider exclusion, multi-commodity optimisation across concurrent demands.
 */

export interface GraphNode {
  id: string;
  up: boolean;
}
export interface GraphSegment {
  id: string;
  a: string;
  b: string;
  providerId: string;
  providerEligible: boolean;
  up: boolean;
  availableMbps: number;
  latencyMs: number;
  lengthKm: number;
  pricePerGbpsMonth: number;
  setupFee: number;
  srlg: string | null;
}
export interface Topology {
  nodes: GraphNode[];
  segments: GraphSegment[];
}

export type Objective = 'LATENCY' | 'COST' | 'BALANCED';

export interface RouteRequest {
  fromNode: string;
  toNode: string;
  bandwidthMbps: number;
  protection: 'NONE' | 'PROTECTED';
  maxLatencyMs?: number;
  objective?: Objective;
  excludeProviders?: string[];
  excludeSegments?: string[];
  k?: number;
  nodeProcessingMs?: number;
}

export interface Path {
  nodeIds: string[];
  segmentIds: string[];
  latencyMs: number;
  lengthKm: number;
  pricePerGbpsMonth: number;
  setupFee: number;
  providers: string[];
  bottleneckMbps: number;
  weight: number;
}

export type RejectReason =
  | 'SAME_ENDPOINTS'
  | 'ENDPOINT_DOWN'
  | 'NO_PATH'
  | 'PROVIDER_NOT_ELIGIBLE'
  | 'INSUFFICIENT_CAPACITY'
  | 'SLA_NOT_MET'
  | 'NO_DIVERSE_PATH';

export interface RouteCandidate {
  primary: Path;
  protection?: Path;
  totalWeight: number;
}

export interface RouteResult {
  feasible: boolean;
  candidates: RouteCandidate[];
  reason?: RejectReason;
  explanation?: string;
  /** Max bandwidth a single unconstrained-by-capacity path could carry right now (widest path). */
  maxFeasibleMbps?: number;
  /** Lowest achievable latency ignoring the SLA cap (for SLA_NOT_MET). */
  bestLatencyMs?: number;
}

type Adj = Map<string, { seg: GraphSegment; to: string }[]>;

function weightOf(s: GraphSegment, obj: Objective): number {
  switch (obj) {
    case 'COST':
      return s.pricePerGbpsMonth / 1_000_000 + 0.001; // + epsilon: prefer fewer hops at equal cost
    case 'BALANCED':
      // Arbitrary demo weighting: 1 ms ~ Rp 1 juta per Gbps-month.
      return s.latencyMs + s.pricePerGbpsMonth / 1_000_000;
    default:
      return s.latencyMs + 0.0001;
  }
}

function buildAdj(segments: GraphSegment[], nodesUp: Set<string>): Adj {
  const adj: Adj = new Map();
  const add = (from: string, to: string, seg: GraphSegment) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ seg, to });
  };
  for (const s of segments) {
    if (!nodesUp.has(s.a) || !nodesUp.has(s.b)) continue;
    add(s.a, s.b, s);
    add(s.b, s.a, s);
  }
  // Deterministic neighbour order => deterministic tie-breaking.
  for (const list of adj.values()) list.sort((x, y) => x.seg.id.localeCompare(y.seg.id));
  return adj;
}

function dijkstra(
  adj: Adj,
  src: string,
  dst: string,
  obj: Objective,
  bannedSegs: Set<string>,
  bannedNodes: Set<string>,
): { nodeIds: string[]; segs: GraphSegment[] } | null {
  const dist = new Map<string, number>([[src, 0]]);
  const prev = new Map<string, { node: string; seg: GraphSegment }>();
  const visited = new Set<string>();
  // Topologies here are small (tens of nodes); an O(V^2) scan keeps it simple and deterministic.
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) {
      if (!visited.has(n) && (d < best || (d === best && u !== null && n < u))) {
        best = d;
        u = n;
      }
    }
    if (u === null) return null;
    if (u === dst) break;
    visited.add(u);
    for (const { seg, to } of adj.get(u) ?? []) {
      if (bannedSegs.has(seg.id) || bannedNodes.has(to) || visited.has(to)) continue;
      const nd = best + weightOf(seg, obj);
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node: u, seg });
      }
    }
  }
  const nodeIds = [dst];
  const segs: GraphSegment[] = [];
  let cur = dst;
  while (cur !== src) {
    const p = prev.get(cur)!;
    segs.unshift(p.seg);
    nodeIds.unshift(p.node);
    cur = p.node;
  }
  return { nodeIds, segs };
}

function toPath(nodeIds: string[], segs: GraphSegment[], obj: Objective, nodeMs: number): Path {
  const providers: string[] = [];
  for (const s of segs) if (!providers.includes(s.providerId)) providers.push(s.providerId);
  return {
    nodeIds,
    segmentIds: segs.map((s) => s.id),
    latencyMs: round3(segs.reduce((a, s) => a + s.latencyMs, 0) + nodeIds.length * nodeMs),
    lengthKm: round3(segs.reduce((a, s) => a + s.lengthKm, 0)),
    pricePerGbpsMonth: segs.reduce((a, s) => a + s.pricePerGbpsMonth, 0),
    setupFee: segs.reduce((a, s) => a + s.setupFee, 0),
    providers,
    bottleneckMbps: Math.min(...segs.map((s) => s.availableMbps)),
    weight: round3(segs.reduce((a, s) => a + weightOf(s, obj), 0)),
  };
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Yen's algorithm: up to k loopless shortest paths in non-decreasing weight. */
export function kShortestPaths(
  segments: GraphSegment[],
  nodesUp: Set<string>,
  src: string,
  dst: string,
  k: number,
  obj: Objective,
  nodeMs = 0,
): Path[] {
  const adj = buildAdj(segments, nodesUp);
  const first = dijkstra(adj, src, dst, obj, new Set(), new Set());
  if (!first) return [];
  const A: Path[] = [toPath(first.nodeIds, first.segs, obj, nodeMs)];
  const B: Path[] = [];
  const segById = new Map(segments.map((s) => [s.id, s]));
  const key = (p: Path) => p.segmentIds.join('|');
  for (let i = 1; i < k; i++) {
    const last = A[i - 1];
    for (let j = 0; j < last.nodeIds.length - 1; j++) {
      const spur = last.nodeIds[j];
      const rootNodes = last.nodeIds.slice(0, j + 1);
      const rootSegs = last.segmentIds.slice(0, j);
      const bannedSegs = new Set<string>();
      for (const p of A) {
        if (p.nodeIds.length > j && p.nodeIds.slice(0, j + 1).join('|') === rootNodes.join('|')) bannedSegs.add(p.segmentIds[j]);
      }
      const bannedNodes = new Set(rootNodes.slice(0, -1));
      const spurPath = dijkstra(adj, spur, dst, obj, bannedSegs, bannedNodes);
      if (!spurPath) continue;
      const segs = [...rootSegs.map((id) => segById.get(id)!), ...spurPath.segs];
      const cand = toPath([...rootNodes.slice(0, -1), ...spurPath.nodeIds], segs, obj, nodeMs);
      if (!A.some((p) => key(p) === key(cand)) && !B.some((p) => key(p) === key(cand))) B.push(cand);
    }
    if (B.length === 0) break;
    B.sort((x, y) => x.weight - y.weight || key(x).localeCompare(key(y)));
    A.push(B.shift()!);
  }
  return A;
}

export function areDisjoint(p: Path, q: Path, segById: Map<string, GraphSegment>): boolean {
  const ps = new Set(p.segmentIds);
  if (q.segmentIds.some((s) => ps.has(s))) return false;
  const srlgP = new Set(p.segmentIds.map((s) => segById.get(s)?.srlg).filter(Boolean));
  if (q.segmentIds.some((s) => { const g = segById.get(s)?.srlg; return g && srlgP.has(g); })) return false;
  const inner = (x: Path) => new Set(x.nodeIds.slice(1, -1));
  const pi = inner(p);
  for (const n of inner(q)) if (pi.has(n)) return false;
  return true;
}

/** Widest (max-bottleneck) path value between two nodes; 0 if disconnected. */
export function widestPathMbps(segments: GraphSegment[], nodesUp: Set<string>, src: string, dst: string): number {
  const adj = buildAdj(segments, nodesUp);
  const width = new Map<string, number>([[src, Infinity]]);
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null;
    let best = -1;
    for (const [n, w] of width) if (!done.has(n) && w > best) { best = w; u = n; }
    if (u === null) return 0;
    if (u === dst) return best === Infinity ? 0 : best;
    done.add(u);
    for (const { seg, to } of adj.get(u) ?? []) {
      const w = Math.min(best, seg.availableMbps);
      if (w > (width.get(to) ?? -1)) width.set(to, w);
    }
  }
}

export function computeRoutes(topo: Topology, req: RouteRequest): RouteResult {
  const obj = req.objective ?? 'LATENCY';
  const k = req.k ?? 12;
  const nodeMs = req.nodeProcessingMs ?? 0.05;
  if (req.fromNode === req.toNode) return { feasible: false, candidates: [], reason: 'SAME_ENDPOINTS', explanation: 'A and B endpoints are the same location.' };

  const nodesUp = new Set(topo.nodes.filter((n) => n.up).map((n) => n.id));
  const allNodes = new Set(topo.nodes.map((n) => n.id));
  if (!nodesUp.has(req.fromNode) || !nodesUp.has(req.toNode)) {
    return { feasible: false, candidates: [], reason: 'ENDPOINT_DOWN', explanation: 'An endpoint node is operationally down.' };
  }
  const exclP = new Set(req.excludeProviders ?? []);
  const exclS = new Set(req.excludeSegments ?? []);
  const segById = new Map(topo.segments.map((s) => [s.id, s]));

  const base = topo.segments.filter((s) => !exclS.has(s.id));
  const up = base.filter((s) => s.up);
  const eligible = up.filter((s) => s.providerEligible && !exclP.has(s.providerId));
  const withCap = eligible.filter((s) => s.availableMbps >= req.bandwidthMbps);

  let paths = kShortestPaths(withCap, nodesUp, req.fromNode, req.toNode, k, obj, nodeMs);
  const latencyCap = req.maxLatencyMs;
  const slaPaths = latencyCap === undefined ? paths : paths.filter((p) => p.latencyMs <= latencyCap);

  if (slaPaths.length === 0) {
    // Diagnose, from most to least fundamental.
    if (kShortestPaths(base, allNodes, req.fromNode, req.toNode, 1, obj).length === 0)
      return { feasible: false, candidates: [], reason: 'NO_PATH', explanation: 'No physical path exists between the endpoints in the modelled topology.' };
    if (kShortestPaths(up, nodesUp, req.fromNode, req.toNode, 1, obj).length === 0)
      return { feasible: false, candidates: [], reason: 'NO_PATH', explanation: 'All paths traverse a segment or node that is currently down.' };
    if (kShortestPaths(eligible, nodesUp, req.fromNode, req.toNode, 1, obj).length === 0)
      return { feasible: false, candidates: [], reason: 'PROVIDER_NOT_ELIGIBLE', explanation: 'Every available path uses an ineligible or excluded provider.' };
    if (paths.length === 0) {
      const max = widestPathMbps(eligible, nodesUp, req.fromNode, req.toNode);
      return {
        feasible: false, candidates: [], reason: 'INSUFFICIENT_CAPACITY', maxFeasibleMbps: max,
        explanation: `No path has ${req.bandwidthMbps} Mbps free on every segment. Largest bandwidth available on a single path right now: ${max} Mbps.`,
      };
    }
    return {
      feasible: false, candidates: [], reason: 'SLA_NOT_MET', bestLatencyMs: paths[0].latencyMs,
      explanation: `Best feasible path has ${paths[0].latencyMs} ms one-way latency, above the requested ${latencyCap} ms.`,
    };
  }
  paths = slaPaths;

  if (req.protection === 'NONE') {
    return { feasible: true, candidates: paths.slice(0, 5).map((p) => ({ primary: p, totalWeight: p.weight })) };
  }

  const pairs: RouteCandidate[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (!areDisjoint(paths[i], paths[j], segById)) continue;
      const [p, q] = paths[i].latencyMs <= paths[j].latencyMs ? [paths[i], paths[j]] : [paths[j], paths[i]];
      pairs.push({ primary: p, protection: q, totalWeight: round3(p.weight + q.weight) });
    }
  }
  pairs.sort((x, y) => x.totalWeight - y.totalWeight || x.primary.segmentIds.join().localeCompare(y.primary.segmentIds.join()));
  if (pairs.length === 0) {
    return {
      feasible: false, candidates: [], reason: 'NO_DIVERSE_PATH',
      explanation: `Found ${paths.length} feasible path(s) but no segment/SRLG/node-disjoint pair among the top ${k} candidates.`,
    };
  }
  return { feasible: true, candidates: pairs.slice(0, 5) };
}
