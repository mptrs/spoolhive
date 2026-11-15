import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { canEdit, useApp } from '../lib/store';
import { href, navigate } from '../lib/router';
import { colourGroups, families, type ColourGroup } from '../lib/stock';
import { JumpNav, Reels, SearchField, filterFamilies } from '../components/stock';
import { needsSpool } from '../lib/types';
import { Icon, SpoolDisc, TabBar } from '../components/ui';
import { SpoolDetail } from './SpoolDetail';
import { useHeaderHeight, useWide } from '../lib/viewport';

export function Inventory({ selected }: { selected: string | null }): JSX.Element {
  const app = useApp();
  const wide = useWide();
  const header = useHeaderHeight<HTMLElement>();
  const { inv } = app;
  const writable = canEdit(app);
  const [query, setQuery] = useState('');

  const all = useMemo(() => families(inv.spools), [inv.spools]);
  const lowCount = useMemo(() => colourGroups(inv.spools).filter((g) => g.low).length, [inv.spools]);

  const visible = useMemo(() => filterFamilies(all, query), [all, query]);

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

        <div style={{ marginTop: '12px' }}>
          <SearchField value={query} onInput={setQuery} />
        </div>

        <JumpNav families={visible} header={header} />
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
              <GroupRow key={g.key} group={g} selected={selected} />
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
            {inv.spools.some((s) => s.form === 'refill' && s.mounted) && (
              <span>
                <span class="reel reel--reusable" style={{ height: '16px' }}>
                  <span style={{ height: '60%', background: 'var(--green)' }} />
                </span>
                on reusable spool
              </span>
            )}
            {inv.spools.some(needsSpool) && (
              <span>
                <span class="reel reel--sealed reel--refill" />
                refill, no spool yet
              </span>
            )}
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

function summary(g: ColourGroup): string {
  const open = g.spools.length - g.sealed;
  const parts = [];
  if (g.sealed) parts.push(`${g.sealed} sealed`);
  if (open === 1) parts.push(`1 open at ${Math.round(g.openPct)}%`);
  else if (open > 1) parts.push(`${open} open`);
  return parts.join(', ');
}

/**
 * One card per colour. Picking it opens its first spool - the loaded one, else
 * the fullest open one - and the spool page switches between the others, so the
 * list never has to fold open.
 */
function GroupRow({ group: g, selected }: { group: ColourGroup; selected: string | null }): JSX.Element {
  const first = g.spools[0];
  const count = g.spools.length > 1 ? `${g.spools.length} spools, ` : '';
  return (
    <a
      class="colourrow"
      data-active={g.spools.some((s) => s.id === selected)}
      href={href(`/spool/${first.id}`)}
      onClick={(e) => swapSpool(e, selected, first.id)}
      aria-label={`${g.colorName}, ${g.brand} ${g.material}: ${count}${summary(g)}${g.loaded ? ', in a printer' : ''}`}
    >
      <SpoolDisc hex={g.hex} hexes={g.hexes} pct={first.remainingPct} reusable={first.form === 'refill' && first.mounted} size={30} />
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
    </a>
  );
}
