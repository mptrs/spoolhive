import { isLoaded, type Spool } from './types';

/** No sealed spare and this much (in % of one spool) left across the open ones: order now. */
export const LOW_PCT = 30;
/** No sealed spare and this much left: worth adding to the next order. */
export const TIGHT_PCT = 50;

/** PLA Matte, PLA+ and Silk PLA are all PLA; Rapid PETG is PETG. */
export function family(material: string): string {
  const m = material.toUpperCase();
  for (const f of ['PETG', 'PCTG', 'TPU', 'ASA', 'ABS', 'PLA', 'PVA', 'PA', 'PC']) {
    if (new RegExp(`(^|[^A-Z])${f}([^A-Z]|$)`).test(m) || m.startsWith(f)) return f;
  }
  return material.trim().split(/\s+/)[0] || 'Other';
}

/** One colour of one product, however many spools of it you own. */
export interface ColourGroup {
  key: string;
  brand: string;
  material: string;
  colorName: string;
  hex: string;
  hexes?: string[];
  /** Loaded first, then fullest open, then sealed. */
  spools: Spool[];
  sealed: number;
  /** What is left on the open spools together, in % of one spool. */
  openPct: number;
  loaded: boolean;
  /** Nothing sealed, and the open spools together are nearly empty. */
  low: boolean;
  tight: boolean;
}

export interface Family {
  name: string;
  groups: ColourGroup[];
  spools: number;
  sealed: number;
}

function groupKey(s: Spool): string {
  return `${s.brand}|${s.material}|${s.colorName}|${s.hex}`.toLowerCase();
}

function byName(a: ColourGroup, b: ColourGroup): number {
  return (
    a.colorName.localeCompare(b.colorName, undefined, { sensitivity: 'base' }) ||
    a.brand.localeCompare(b.brand) ||
    a.material.localeCompare(b.material)
  );
}

export function colourGroups(spools: Spool[]): ColourGroup[] {
  const map = new Map<string, Spool[]>();
  for (const s of spools) {
    const k = groupKey(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()].map(([key, members]) => {
    const first = members[0];
    const open = members.filter((s) => !s.sealed);
    const sealed = members.length - open.length;
    const openPct = open.reduce((sum, s) => sum + s.remainingPct, 0);
    const rank = (s: Spool): number => (isLoaded(s) ? 0 : s.sealed ? 2 : 1);
    return {
      key,
      brand: first.brand,
      material: first.material,
      colorName: first.colorName,
      hex: first.hex,
      hexes: first.hexes,
      spools: [...members].sort((a, b) => rank(a) - rank(b) || b.remainingPct - a.remainingPct),
      sealed,
      openPct,
      loaded: members.some(isLoaded),
      low: sealed === 0 && openPct <= LOW_PCT,
      tight: sealed === 0 && openPct > LOW_PCT && openPct <= TIGHT_PCT,
    };
  });
}

/** Families biggest first; colours inside alphabetical. */
export function families(spools: Spool[]): Family[] {
  const map = new Map<string, Spool[]>();
  for (const s of spools) {
    const f = family(s.material);
    map.set(f, [...(map.get(f) ?? []), s]);
  }
  return [...map.entries()]
    .map(([name, members]) => ({
      name,
      groups: colourGroups(members).sort(byName),
      spools: members.length,
      sealed: members.filter((s) => s.sealed).length,
    }))
    .sort((a, b) => b.spools - a.spools || a.name.localeCompare(b.name));
}
