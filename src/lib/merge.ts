import type { Inventory } from './types';

/**
 * Three-way merge of the inventory, for when another device pushed while this
 * one had edits queued.
 *
 * `base` is the version both sides started from, `local` is this device's copy
 * with its unsent edits, `remote` is what GitHub has now. Every spool and
 * printer is merged field by field, so edits to different spools, or to
 * different fields of one spool, simply both land.
 *
 * When both sides changed the same field:
 *  - Filament levels and counters add up: a print on each device both used
 *    filament, so both drops count.
 *  - Anything else keeps this device's value, since that is the edit the
 *    person here just made.
 *
 * The result has not been through `reconcile` yet; the caller runs it, which
 * also settles two spools that each side put into the same slot.
 */
export function mergeInventory(base: Inventory, local: Inventory, remote: Inventory): Inventory {
  return {
    ...remote,
    printers: mergeList(base.printers, local.printers, remote.printers),
    spools: mergeList(base.spools, local.spools, remote.spools, ['remainingPct']),
    emptySpools: addDeltas(base.emptySpools, local.emptySpools, remote.emptySpools),
    resealBags: addDeltas(base.resealBags ?? 0, local.resealBags ?? 0, remote.resealBags ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

type Item = { id: string };
type Fields = Record<string, unknown>;

function mergeList<T extends Item>(base: T[], local: T[], remote: T[], additive: string[] = []): T[] {
  const baseById = new Map(base.map((x) => [x.id, x]));
  const localById = new Map(local.map((x) => [x.id, x]));
  const remoteById = new Map(remote.map((x) => [x.id, x]));

  const pick = (id: string): T | undefined => {
    const b = baseById.get(id);
    const l = localById.get(id);
    const r = remoteById.get(id);
    if (!b) return l ?? r; // added on one side (ids are UUIDs, so never on both)
    // Removed on one side: the removal wins unless the other side edited it since.
    if (!l) return r && !same(r, b) ? r : undefined;
    if (!r) return !same(l, b) ? l : undefined;
    return mergeFields(b, l, r, additive);
  };

  // Things added on this device go first, in this device's order: new spools
  // are added at the top. Everything else follows GitHub's order.
  const out: T[] = [];
  const seen = new Set<string>();
  for (const x of local) {
    if (!baseById.has(x.id) && !remoteById.has(x.id)) {
      out.push(x);
      seen.add(x.id);
    }
  }
  for (const x of remote) {
    const merged = pick(x.id);
    if (merged) out.push(merged);
    seen.add(x.id);
  }
  // Kept by this device but removed on GitHub after an edit here.
  for (const x of local) {
    if (seen.has(x.id)) continue;
    const merged = pick(x.id);
    if (merged) out.push(merged);
  }
  return out;
}

function mergeFields<T extends Item>(b: T, l: T, r: T, additive: string[]): T {
  const bf = b as unknown as Fields;
  const lf = l as unknown as Fields;
  const rf = r as unknown as Fields;
  const out: Fields = {};
  for (const key of new Set([...Object.keys(rf), ...Object.keys(lf)])) {
    const bv = bf[key];
    const lv = lf[key];
    const rv = rf[key];
    let v: unknown;
    if (same(lv, bv)) v = rv;
    else if (same(rv, bv) || same(lv, rv)) v = lv;
    else if (additive.includes(key) && typeof bv === 'number' && typeof lv === 'number' && typeof rv === 'number') {
      v = addDeltas(bv, lv, rv);
    } else v = lv;
    if (v !== undefined) out[key] = v;
  }
  return out as unknown as T;
}

function addDeltas(base: number, local: number, remote: number): number {
  return base + (local - base) + (remote - base);
}

/** Deep equality that ignores key order, as JSON round-trips may reorder keys. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ao = a as Fields;
  const bo = b as Fields;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!same(ao[k], bo[k])) return false;
  return true;
}
