import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { back, href } from '../lib/router';
import { families, type ColourGroup } from '../lib/stock';
import { locationText, needsSpool, totalSlots, type Inventory, type Location, type Spool } from '../lib/types';
import { BackButton, Icon, Note, SpoolDisc } from '../components/ui';
import { JumpNav, Reels, SearchField, filterFamilies } from '../components/stock';
import { mountRefill, setLocation } from '../lib/actions';
import { useHeaderHeight } from '../lib/viewport';

/**
 * Which of a colour's spools to reach for first: something already open on the
 * shelf (emptiest first, to use it up), then a sealed spool, then a refill that
 * still has to go onto a spool, and only then one taken out of another slot.
 */
function rank(s: Spool): number {
  if (s.location.kind !== 'storage') return 3;
  if (needsSpool(s)) return 2;
  return s.sealed ? 1 : 0;
}

function byPreference(a: Spool, b: Spool): number {
  return rank(a) - rank(b) || (a.sealed ? 100 : a.remainingPct) - (b.sealed ? 100 : b.remainingPct);
}

export function LoadSlot({ printerId, slot }: { printerId: string; slot: number }): JSX.Element {
  const { inv } = useApp();
  const header = useHeaderHeight<HTMLElement>();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const printer = inv.printers.find((p) => p.id === printerId);
  const hasAms = (printer?.amsUnits ?? 0) > 0;

  // Everything that could go in: not what is already in this slot, and not a spool that ran out.
  const candidates = useMemo(
    () => inv.spools.filter((s) => !(s.location.kind !== 'storage' && s.location.printer === printerId && sameSlot(s, hasAms, slot)) && (s.sealed || s.remainingPct > 0)),
    [inv.spools, printerId, hasAms, slot],
  );
  const all = useMemo(
    () => families(candidates).map((f) => ({ ...f, groups: f.groups.map((g) => ({ ...g, spools: [...g.spools].sort(byPreference) })) })),
    [candidates],
  );
  const visible = useMemo(() => filterFamilies(all, query), [all, query]);

  if (!printer || slot < 1 || slot > totalSlots(printer)) {
    return (
      <div class="screen">
        <header class="topbar">
          <Icon name="printer" />
          <div class="topbar__title">Load slot</div>
        </header>
        <div class="screen__body">
          <div class="empty">That slot no longer exists.</div>
        </div>
      </div>
    );
  }

  const target: Location = hasAms ? { kind: 'ams', printer: printerId, slot } : { kind: 'direct', printer: printerId };
  const current = inv.spools.find((s) => s.location.kind !== 'storage' && s.location.printer === printerId && sameSlot(s, hasAms, slot));

  const load = (spool: Spool): void => {
    if (needsSpool(spool)) mountRefill(spool.id, target);
    else setLocation(spool.id, target);
    back('/');
  };

  const addLink = href(`/add?printer=${printerId}&slot=${slot}`);

  return (
    <div class="screen screen--wide">
      <header ref={header} class="topbar" style={{ display: 'block', borderBottom: '1px solid var(--line-soft)' }}>
        <div class="row" style={{ gap: '12px' }}>
          <BackButton to="/" label="Back to printers" />
          <div class="grow" style={{ minWidth: 0 }}>
            <div class="topbar__title">Load {hasAms ? `A${slot}` : printer.name}</div>
            <div class="muted truncate">
              {printer.name}
              {current ? ` · now ${current.colorName} ${current.material}` : ' · empty'}
            </div>
          </div>
        </div>

        {candidates.length > 0 && (
          <>
            <div style={{ marginTop: '12px' }}>
              <SearchField value={query} onInput={setQuery} />
            </div>
            <JumpNav families={visible} header={header} />
          </>
        )}
      </header>

      <div class="screen__body">
        {visible.length === 0 && <div class="empty">{candidates.length === 0 ? 'Nothing to load.' : 'No spools match that.'}</div>}

        {visible.map((f) => (
          <section key={f.name} id={`fam-${f.name}`}>
            <div class="famhead">
              <h2>{f.name}</h2>
              <div class="famhead__sub">
                {f.groups.length} {f.groups.length === 1 ? 'colour' : 'colours'}
              </div>
            </div>
            <div class="groups">
              {f.groups.map((g) => (
                <LoadGroup
                  key={g.key}
                  group={g}
                  inv={inv}
                  open={open === g.key}
                  onToggle={() => setOpen(open === g.key ? null : g.key)}
                  onPick={load}
                />
              ))}
            </div>
          </section>
        ))}

        <a
          href={addLink}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: '1px dashed #343941', borderRadius: '16px', padding: '16px', marginTop: '18px' }}
        >
          <Icon name="plus" />
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Add a new spool</span>
        </a>

        <div class="stack" style={{ marginTop: '14px', gap: '8px' }}>
          <Note>Loading a sealed spool marks it opened — you had to break the seal to get it in.</Note>
          {candidates.some(needsSpool) && (
            <Note>
              {inv.emptySpools === 0
                ? 'Refills need an empty spool to go on, and none is free right now.'
                : `Picking a refill winds it onto one of your ${inv.emptySpools} free empty ${inv.emptySpools === 1 ? 'spool' : 'spools'}.`}
            </Note>
          )}
        </div>
      </div>
    </div>
  );
}

function chipLabel(inv: Inventory, s: Spool): { text: string; tag?: string; go?: boolean } {
  const level = s.sealed ? 'sealed' : `${s.remainingPct}%`;
  if (s.location.kind !== 'storage') return { text: level, tag: locationText(inv, s.location) };
  if (needsSpool(s)) return inv.emptySpools > 0 ? { text: 'refill', tag: 'onto spool', go: true } : { text: 'refill', tag: 'no spool free' };
  if (s.form === 'refill') return { text: level, tag: 'refill' };
  return { text: level };
}

/**
 * One card per colour, like Inventory. A colour with a single spool that can
 * go straight in loads on tap; otherwise it folds open to pick one.
 */
function LoadGroup({
  group: g,
  inv,
  open,
  onToggle,
  onPick,
}: {
  group: ColourGroup;
  inv: Inventory;
  open: boolean;
  onToggle: () => void;
  onPick: (s: Spool) => void;
}): JSX.Element {
  const first = g.spools[0];
  const usable = (s: Spool): boolean => !needsSpool(s) || inv.emptySpools > 0;
  const direct = g.spools.length === 1 && !needsSpool(first) && first.location.kind === 'storage';
  const elsewhere = g.spools.some((s) => s.location.kind !== 'storage');
  const count = g.spools.length > 1 ? `${g.spools.length} spools` : direct ? 'load it' : 'pick one';

  return (
    <div class="loadgroup" data-open={open}>
      <button
        type="button"
        class="colourrow"
        aria-expanded={direct ? undefined : open}
        aria-label={`${g.colorName}, ${g.brand} ${g.material}: ${count}`}
        onClick={() => (direct ? onPick(first) : onToggle())}
      >
        <SpoolDisc hex={g.hex} hexes={g.hexes} pct={needsSpool(first) ? 100 : first.remainingPct} reusable={first.form === 'refill' && first.mounted} size={30} />
        <span class="grow" style={{ minWidth: 0 }}>
          <span class="colourrow__name truncate">{g.colorName}</span>
          <span class="colourrow__sub truncate">
            {g.brand} · {g.material}
          </span>
        </span>
        <span class="colourrow__printer">{elsewhere && <Icon name="loaded" size={18} />}</span>
        <Reels spools={g.spools} />
      </button>

      {open && !direct && (
        <div class="spoolchips" role="group" aria-label={`Which ${g.colorName} to load`}>
          {alike(g.spools).map(({ spool: s, count: n }) => {
            const label = chipLabel(inv, s);
            return (
              <button key={s.id} type="button" class="spoolchip" disabled={!usable(s)} onClick={() => onPick(s)}>
                <SpoolDisc hex={s.hex} hexes={s.hexes} pct={needsSpool(s) ? 100 : s.remainingPct} reusable={s.form === 'refill' && s.mounted} size={18} />
                {n > 1 && `${n}× `}
                {label.text}
                {label.tag && <span class={label.go ? 'spoolchip__tag spoolchip__tag--go' : 'spoolchip__tag'}>· {label.tag}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Two sealed spools of one colour are the same choice; show it once, with how many there are. */
function alike(spools: Spool[]): { spool: Spool; count: number }[] {
  const out: { spool: Spool; count: number; key: string }[] = [];
  for (const s of spools) {
    const key = s.sealed && s.location.kind === 'storage' ? `${s.form}|${s.mounted}` : s.id;
    const hit = out.find((o) => o.key === key);
    if (hit) hit.count += 1;
    else out.push({ spool: s, count: 1, key });
  }
  return out;
}

function sameSlot(spool: Spool, hasAms: boolean, slot: number): boolean {
  if (spool.location.kind === 'ams') return hasAms && spool.location.slot === slot;
  return spool.location.kind === 'direct' && !hasAms;
}
