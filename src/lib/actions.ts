import { mutate } from './store';
import { totalSlots, type Inventory, type Location, type Printer, type Spool } from './types';
import { newId } from './util';

export function addSpool(spool: Omit<Spool, 'id' | 'addedAt'>): string {
  const id = newId();
  const loaded = spool.location.kind !== 'storage';
  mutate((inv) => {
    inv.spools.unshift({
      ...spool,
      id,
      addedAt: new Date().toISOString(),
      // Putting it straight into a printer means it is open, whatever the form said.
      ...(loaded && spool.sealed ? { sealed: false, openedAt: new Date().toISOString() } : {}),
    });
    // A refill that arrives already on a reusable spool takes one from the pool.
    if (spool.form === 'refill' && spool.mounted) inv.emptySpools = Math.max(0, inv.emptySpools - 1);
  }, `Add ${spool.brand} ${spool.material} ${spool.colorName}`);
  return id;
}

export function updateSpool(id: string, patch: Partial<Spool>, message?: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (spool) Object.assign(spool, patch);
  }, message ?? 'Update spool');
}

export function deleteSpool(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    // A refill still on its reusable spool hands the spool back. One that ran out
    // already gave it back then, and a regular spool is only counted when it runs
    // out, after asking whether it was reusable.
    if (spool?.form === 'refill' && spool.mounted) inv.emptySpools += 1;
    inv.spools = inv.spools.filter((s) => s.id !== id);
  }, 'Remove spool');
}

/** Puts a spool somewhere, evicting whatever already sits in the target slot. */
function place(inv: Inventory, id: string, location: Location): void {
  if (location.kind !== 'storage') {
    for (const other of inv.spools) {
      if (other.id === id) continue;
      const l = other.location;
      if (l.kind === 'storage' || l.printer !== location.printer) continue;
      const clash = location.kind === 'ams' ? l.kind === 'ams' && l.slot === location.slot : l.kind === 'direct';
      if (clash) other.location = { kind: 'storage' };
    }
  }
  const spool = inv.spools.find((s) => s.id === id);
  if (!spool) return;
  // Putting a spool in a printer means you opened it to get it there.
  if (location.kind !== 'storage' && spool.sealed) {
    spool.sealed = false;
    spool.openedAt = spool.openedAt ?? new Date().toISOString();
  }
  spool.location = location;
}

/** Moves a spool, evicting whatever already sits in the target slot. */
export function setLocation(id: string, location: Location): void {
  mutate((inv) => place(inv, id, location), 'Move spool');
}

/** Takes a spool out of a printer or AMS slot and back to storage. */
export function unloadSpool(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (spool) spool.location = { kind: 'storage' };
  }, 'Unload spool');
}

/**
 * Used up: it comes out of the printer, and a refill's reusable spool goes back
 * to the pool. It stays in the inventory so Reorder still sees it.
 */
function runOut(inv: Inventory, spool: Spool): void {
  spool.remainingPct = 0;
  spool.location = { kind: 'storage' };
  if (spool.form === 'refill' && spool.mounted) {
    spool.mounted = false;
    inv.emptySpools += 1;
  }
}

/** Ran out: still in the inventory so you know to reorder, but no longer sealed. */
export function markEmpty(id: string): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool) return;
    spool.sealed = false;
    spool.openedAt = spool.openedAt ?? new Date().toISOString();
    runOut(inv, spool);
  }, 'Mark spool empty');
}

/** A regular spool ran out and its spool can be reused. */
export function returnEmptySpool(): void {
  mutate((inv) => {
    inv.emptySpools += 1;
  }, 'Return an empty spool');
}

/**
 * A print used `grams` of this spool - the weight Bambu Studio shows for it.
 * Printing is the only thing that uses filament up, so it is the only way the
 * level goes down. Printing from a sealed spool means it has been opened.
 */
export function recordPrint(id: string, grams: number): void {
  if (!(grams > 0)) return;
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool || spool.netWeightG <= 0) return;
    if (spool.sealed) {
      spool.sealed = false;
      spool.openedAt = spool.openedAt ?? new Date().toISOString();
    }
    const left = (spool.netWeightG * spool.remainingPct) / 100 - grams;
    spool.remainingPct = Math.max(0, (left / spool.netWeightG) * 100);
    // Stored levels are whole percents, so below half a percent it is gone.
    if (spool.remainingPct < 0.5) runOut(inv, spool);
  }, `Print used ${Math.round(grams)} g`);
}

/** Opening a spool is what lets it have a level, a dry state and a location. */
export function setSealed(id: string, sealed: boolean): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool) return;
    spool.sealed = sealed;
    if (sealed) spool.openedAt = undefined;
    else spool.openedAt = spool.openedAt ?? new Date().toISOString();
  }, sealed ? 'Mark spool sealed' : 'Mark spool opened');
}

/** Winds a refill onto a free reusable spool, and loads it straight away when given a place. */
export function mountRefill(id: string, location?: Location): void {
  mutate((inv) => {
    const spool = inv.spools.find((s) => s.id === id);
    if (!spool || spool.mounted || inv.emptySpools <= 0) return;
    spool.mounted = true;
    inv.emptySpools -= 1;
    // Winding a refill onto a spool means the bag is open.
    if (spool.sealed) {
      spool.sealed = false;
      spool.openedAt = spool.openedAt ?? new Date().toISOString();
    }
    if (location) place(inv, id, location);
  }, location ? 'Mount refill and load it' : 'Mount refill on a spool');
}

export function setEmptySpools(n: number): void {
  mutate((inv) => {
    inv.emptySpools = Math.max(0, n);
  }, 'Update empty spool count');
}

export function upsertPrinter(printer: Printer): void {
  mutate((inv) => {
    const existing = inv.printers.find((p) => p.id === printer.id);
    const hadAms = existing ? existing.amsUnits > 0 : printer.amsUnits > 0;
    if (existing) Object.assign(existing, printer);
    else inv.printers.push(printer);

    const mine = inv.spools.filter((s) => s.location.kind !== 'storage' && s.location.printer === printer.id);

    if (!hadAms && printer.amsUnits > 0) {
      // Fitting a unit: whatever was loaded straight into the printer is now
      // sitting in the first slot, not suddenly back on the shelf.
      const taken = new Set(mine.filter((s) => s.location.kind === 'ams').map((s) => (s.location as { slot: number }).slot));
      for (const spool of mine) {
        if (spool.location.kind !== 'direct') continue;
        spool.location = taken.has(1) ? { kind: 'storage' } : { kind: 'ams', printer: printer.id, slot: 1 };
        taken.add(1);
      }
    } else if (hadAms && printer.amsUnits === 0) {
      // Taking the unit off: slot one keeps feeding the printer, the rest go back.
      for (const spool of mine) {
        if (spool.location.kind !== 'ams') continue;
        spool.location = spool.location.slot === 1 ? { kind: 'direct', printer: printer.id } : { kind: 'storage' };
      }
    }

    // Losing slots must not leave spools pointing at somewhere that no longer
    // exists - send those back to storage instead.
    const max = totalSlots(printer);
    for (const spool of inv.spools) {
      const l = spool.location;
      if (l.kind === 'storage' || l.printer !== printer.id) continue;
      if (printer.amsUnits === 0 && l.kind === 'ams') spool.location = { kind: 'storage' };
      else if (printer.amsUnits > 0 && l.kind === 'direct') spool.location = { kind: 'storage' };
      else if (l.kind === 'ams' && l.slot > max) spool.location = { kind: 'storage' };
    }
  }, `Save printer ${printer.name}`);
}

export function deletePrinter(id: string): void {
  mutate((inv) => {
    inv.printers = inv.printers.filter((p) => p.id !== id);
    for (const spool of inv.spools) {
      if (spool.location.kind !== 'storage' && spool.location.printer === id) {
        spool.location = { kind: 'storage' };
      }
    }
  }, 'Remove printer');
}

export function blankPrinter(): Printer {
  return { id: newId(), name: '', model: 'Bambu Lab A1 mini', amsUnits: 0, slotsPerUnit: 4 };
}

export function encodeLocation(loc: Location): string {
  if (loc.kind === 'storage') return 'storage';
  if (loc.kind === 'ams') return `ams:${loc.printer}:${loc.slot}`;
  return `direct:${loc.printer}`;
}

export function decodeLocation(value: string): Location {
  const [kind, printer, slot] = value.split(':');
  if (kind === 'ams') return { kind: 'ams', printer, slot: Number(slot) };
  if (kind === 'direct') return { kind: 'direct', printer };
  return { kind: 'storage' };
}

export function locationOptions(printers: Printer[]): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (const p of printers) {
    if (p.amsUnits > 0) {
      for (let slot = 1; slot <= totalSlots(p); slot++) {
        out.push({ value: `ams:${p.id}:${slot}`, label: `${p.name} · A${slot}` });
      }
    } else {
      out.push({ value: `direct:${p.id}`, label: p.name });
    }
  }
  out.push({ value: 'storage', label: 'Storage' });
  return out;
}
