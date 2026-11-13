import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { canEdit, useApp } from '../lib/store';
import { href, navigate } from '../lib/router';
import { colourGroups, families, type ColourGroup } from '../lib/stock';
import { locationText, type Inventory as Inv, type Spool } from '../lib/types';
import { Icon, Swatch, TabBar } from '../components/ui';
import { SpoolDetail } from './SpoolDetail';
import { useHeaderHeight, useWide } from '../lib/viewport';

export function Inventory({ selected }: { selected: string | null }): JSX.Element {
  const app = useApp();
  const wide = useWide();
  const header = useHeaderHeight<HTMLElement>();
  const { inv } = app;
  const writable = canEdit(app);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const all = useMemo(() => families(inv.spools), [inv.spools]);
  const lowCount = useMemo(() => colourGroups(inv.spools).filter((g) => g.low).length, [inv.spools]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all
      .map((f) => ({
        ...f,
        groups: f.groups.filter((g) => `${g.colorName} ${g.brand} ${g.material}`.toLowerCase().includes(q)),
      }))
      .filter((f) => f.groups.length > 0);
  }, [all, query]);

  const sealed = inv.spools.filter((s) => s.sealed).length;
  const grams = inv.spools.reduce((sum, s) => sum + (s.netWeightG * s.remainingPct) / 100, 0);

  const list = (
    <div class="screen screen--tabbed screen--wide">
      <header ref={header} class="topbar" style={{ display: 'block', borderBottom: '1px solid var(--line-soft)' }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <div class="mono" style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '3px' }}>
          {inv.spools.length} spools · {sealed} sealed · {inv.spools.length - sealed} open · ≈ {(grams / 1000).toFixed(1)} kg
        </div>

        {lowCount > 0 && (
          <a class="reorderbar" href={href('/reorder')} style={{ marginTop: '12px' }}>
            <Icon name="warn" size={16} />
            <span class="grow">
              <b style={{ fontWeight: 600 }}>
                {lowCount} {lowCount === 1 ? 'colour' : 'colours'}
              </b>{' '}
              running low
            </span>
            <span>Reorder ›</span>
          </a>
        )}

        <div class="row" style={{ gap: '9px', marginTop: '12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '11px', padding: '0 12px', height: '42px' }}>
          <Icon name="search" size={16} />
          <label class="sr-only" for="q">
            Search filament
          </label>
          <input
            id="q"
            type="search"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search colour, brand, material"
            style={{ flexGrow: 1, background: 'transparent', border: 0, outline: 'none', minWidth: 0, fontSize: '14px' }}
          />
        </div>

        {visible.length > 1 && (
          <nav class="jump" aria-label="Jump to material" style={{ marginTop: '11px' }}>
            {visible.map((f) => (
              <a
                key={f.name}
                href={`#fam-${f.name}`}
                onClick={(e) => {
                  // The app routes on the hash, so scroll instead of following it,
                  // and stop just under the sticky header rather than behind it.
                  e.preventDefault();
                  const section = document.getElementById(`fam-${f.name}`);
                  if (!section || !header.current) return;
                  window.scrollBy(0, section.getBoundingClientRect().top - header.current.getBoundingClientRect().bottom);
                }}
              >
                {f.name}
                <span>{f.spools}</span>
              </a>
            ))}
          </nav>
        )}
      </header>

      <div class="screen__body">
        {visible.length === 0 && (
          <div class="empty">
            {inv.spools.length === 0 ? (
              <>
                Nothing logged yet.
                {writable && (
                  <>
                    <br />
                    <a href={href('/add')}>Add your first spool</a>
                  </>
                )}
              </>
            ) : (
              'No spools match that.'
            )}
          </div>
        )}

        {visible.map((f) => (
          // The id sits on the section, not the sticky heading: a stuck heading
          // reports where it is pinned, so scrolling to it would go nowhere.
          <section key={f.name} id={`fam-${f.name}`}>
            <div class="famhead">
              <h2>{f.name}</h2>
              <div class="famhead__sub">
                {f.sealed} sealed · {f.spools - f.sealed} open
              </div>
            </div>
            <div class="groups">
            {f.groups.map((g) => (
              <GroupRow
                key={g.key}
                group={g}
                inv={inv}
                selected={selected}
                expanded={open[g.key] ?? g.spools.some((s) => s.id === selected)}
                onToggle={() => setOpen((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
              />
            ))}
            </div>
          </section>
        ))}

        {visible.length > 0 && (
          <div class="legend">
            <span>
              <span class="reel reel--sealed" style={{ height: '16px' }} />
              sealed
            </span>
            <span>
              <span class="reel" style={{ height: '16px' }}>
                <span style={{ height: '60%', background: 'var(--green)' }} />
              </span>
              open
            </span>
            {inv.spools.some((s) => s.inBag) && (
              <span>
                <span class="reel reel--bagged" style={{ height: '16px' }}>
                  <span style={{ height: '60%', background: 'var(--green)' }} />
                </span>
                in reseal bag
              </span>
            )}
            <span>
              <span style={{ color: 'var(--accent)', display: 'flex' }}>
                <Icon name="loaded" size={14} />
              </span>
              in a printer
            </span>
          </div>
        )}
      </div>

      <TabBar active="inventory" />
    </div>
  );

  if (!wide) return list;
  return (
    <div class="split">
      {list}
      <aside class="detailpane" aria-label="Spool">
        {selected ? (
          <SpoolDetail key={selected} id={selected} embedded />
        ) : (
          <div class="empty">Pick a spool to see its level, where it is and what has been used.</div>
        )}
      </aside>
    </div>
  );
}

/**
 * With a spool already open beside the list, picking another one swaps it in
 * place, so Back returns to where you came from instead of through every spool.
 */
function swapSpool(e: MouseEvent, selected: string | null, id: string): void {
  if (selected === null) return;
  e.preventDefault();
  if (id !== selected) navigate(`/spool/${id}`, { replace: true });
}

function levelColour(pct: number): string {
  return pct <= 15 ? 'var(--red)' : pct <= 30 ? 'var(--accent)' : 'var(--green)';
}

const MAX_BARS = 5;

/** Emptiest on the left, filling up to the right; a sealed spool is full, so it comes last. */
function byLevel(a: Spool, b: Spool): number {
  return (a.sealed ? 101 : a.remainingPct) - (b.sealed ? 101 : b.remainingPct);
}

function Reels({ spools }: { spools: Spool[] }): JSX.Element {
  const shown = [...spools].sort(byLevel).slice(0, MAX_BARS);
  return (
    <span class="reels" aria-hidden="true">
      {shown.map((s) =>
        s.sealed ? (
          <span key={s.id} class="reel reel--sealed" />
        ) : (
          <span key={s.id} class={s.inBag ? 'reel reel--bagged' : 'reel'}>
            <span style={{ height: `${Math.max(s.remainingPct, 4)}%`, background: levelColour(s.remainingPct) }} />
          </span>
        ),
      )}
      {spools.length > MAX_BARS && <span class="reels__more">+{spools.length - MAX_BARS}</span>}
    </span>
  );
}

function summary(g: ColourGroup): string {
  const open = g.spools.length - g.sealed;
  const parts = [];
  if (g.sealed) parts.push(`${g.sealed} sealed`);
  if (open === 1) parts.push(`1 open at ${Math.round(g.openPct)}%`);
  else if (open > 1) parts.push(`${open} open`);
  return parts.join(', ');
}

function GroupRow({
  group: g,
  inv,
  selected,
  expanded,
  onToggle,
}: {
  group: ColourGroup;
  inv: Inv;
  selected: string | null;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const body = (
    <>
      <Swatch hex={g.hex} hexes={g.hexes} size={28} radius={14} />
      <span class="grow">
        <span class="colourrow__name truncate" data-low={g.low}>
          {g.colorName}
          {g.low && <span class="sr-only"> (running low)</span>}
        </span>
        <span class="colourrow__sub truncate">
          {g.brand} · {g.material}
        </span>
      </span>
      <span class="colourrow__printer">{g.loaded && <Icon name="loaded" size={18} />}</span>
      <Reels spools={g.spools} />
    </>
  );

  if (g.spools.length === 1) {
    const s = g.spools[0];
    return (
      <a class="colourrow" data-active={s.id === selected} href={href(`/spool/${s.id}`)} onClick={(e) => swapSpool(e, selected, s.id)} aria-label={`${g.colorName}, ${g.brand} ${g.material}: ${summary(g)}${g.loaded ? ', in a printer' : ''}`}>
        {body}
      </a>
    );
  }

  return (
    <>
      <button type="button" class="colourrow" data-active={g.spools.some((s) => s.id === selected)} aria-expanded={expanded} onClick={onToggle} aria-label={`${g.colorName}, ${g.brand} ${g.material}: ${g.spools.length} spools, ${summary(g)}`}>
        {body}
      </button>
      {expanded && (
        <div class="colourrow__members">
          {g.spools.map((s, i) => (
            <a key={s.id} class="colourrow" data-active={s.id === selected} href={href(`/spool/${s.id}`)} onClick={(e) => swapSpool(e, selected, s.id)}>
              <span class="grow">
                <span class="colourrow__name" style={{ fontSize: '13.5px' }}>
                  Spool {i + 1}
                </span>
                <span class="colourrow__sub">{s.location.kind === 'storage' ? (s.sealed ? 'Sealed' : 'Storage') : locationText(inv, s.location)}</span>
              </span>
              <span class="colourrow__printer">{s.location.kind !== 'storage' && <Icon name="loaded" size={18} />}</span>
              <span class="mono" style={{ fontSize: '12px', color: s.sealed ? 'var(--green-text)' : 'var(--text-2)', width: '50px', textAlign: 'right' }}>
                {s.sealed ? 'full' : `${s.remainingPct}%`}
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
