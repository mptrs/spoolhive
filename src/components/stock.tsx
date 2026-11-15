import type { JSX } from 'preact';
import { needsSpool, type Spool } from '../lib/types';
import type { Family } from '../lib/stock';
import { Icon } from './ui';

/** Shared by Inventory and Load: the same colour list, the same way to find your way through it. */

function levelColour(pct: number): string {
  return pct <= 15 ? 'var(--red)' : pct <= 30 ? 'var(--accent)' : 'var(--green)';
}

const MAX_BARS = 5;

/** Emptiest on the left, filling up to the right; a sealed spool is full, so it comes last. */
function byLevel(a: Spool, b: Spool): number {
  return (a.sealed ? 101 : a.remainingPct) - (b.sealed ? 101 : b.remainingPct);
}

export function Reels({ spools }: { spools: Spool[] }): JSX.Element {
  const shown = [...spools].sort(byLevel).slice(0, MAX_BARS);
  return (
    <span class="reels" aria-hidden="true">
      {shown.map((s) =>
        s.sealed ? (
          // A refill with no spool yet is a loose coil: smaller, centred.
          <span key={s.id} class={needsSpool(s) ? 'reel reel--sealed reel--refill' : 'reel reel--sealed'} />
        ) : (
          <span key={s.id} class={['reel', s.inBag && 'reel--bagged', s.form === 'refill' && s.mounted && 'reel--reusable'].filter(Boolean).join(' ')}>
            <span style={{ height: `${Math.max(s.remainingPct, 4)}%`, background: levelColour(s.remainingPct) }} />
          </span>
        ),
      )}
      {spools.length > MAX_BARS && <span class="reels__more">+{spools.length - MAX_BARS}</span>}
    </span>
  );
}

export function SearchField({ value, onInput }: { value: string; onInput: (q: string) => void }): JSX.Element {
  return (
    <div class="searchfield">
      <Icon name="search" size={16} />
      <label class="sr-only" for="q">
        Search filament
      </label>
      <input
        id="q"
        type="search"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder="Search colour, brand, material"
      />
    </div>
  );
}

/** Only matches colours whose name, brand or material contain the query. */
export function filterFamilies(all: Family[], query: string): Family[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all
    .map((f) => ({
      ...f,
      groups: f.groups.filter((g) => `${g.colorName} ${g.brand} ${g.material}`.toLowerCase().includes(q)),
    }))
    .filter((f) => f.groups.length > 0);
}

export function JumpNav({ families, header }: { families: Family[]; header: { current: HTMLElement | null } }): JSX.Element | null {
  if (families.length < 2) return null;
  return (
    <nav class="jump" aria-label="Jump to material" style={{ marginTop: '11px' }}>
      {families.map((f) => (
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
  );
}
