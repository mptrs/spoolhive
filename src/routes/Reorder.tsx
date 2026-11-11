import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../lib/store';
import { href } from '../lib/router';
import { colourGroups, family, LOW_PCT, TIGHT_PCT, type ColourGroup } from '../lib/stock';
import { BackButton, Swatch } from '../components/ui';
import { useHeaderHeight } from '../lib/viewport';

/** Colours about to run out entirely, grouped by material, emptiest first. */
export function Reorder(): JSX.Element {
  const { inv } = useApp();
  const [copied, setCopied] = useState(false);
  const header = useHeaderHeight<HTMLElement>();

  const groups = useMemo(() => {
    const due = colourGroups(inv.spools).filter((g) => g.low || g.tight);
    const map = new Map<string, ColourGroup[]>();
    for (const g of due) {
      const f = family(g.material);
      map.set(f, [...(map.get(f) ?? []), g]);
    }
    return [...map.entries()]
      .map(([name, items]) => ({ name, items: items.sort((a, b) => a.openPct - b.openPct) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  }, [inv.spools]);

  const copy = async (): Promise<void> => {
    const text = groups
      .map((f) => [f.name, ...f.items.map((g) => `- ${g.brand} ${g.material} ${g.colorName} (${Math.round(g.openPct)}% left)`)].join('\n'))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission); nothing to recover.
    }
  };

  return (
    <div class="screen">
      <header ref={header} class="topbar" style={{ display: 'block', borderBottom: '1px solid var(--line-soft)' }}>
        <div class="row">
          <BackButton to="/inventory" label="Back to inventory" />
          <h1 style={{ margin: 0 }}>Reorder</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.45, color: 'var(--dim)' }}>
          Colours you are about to run out of completely. Open spools of the same colour count together. Order in one go to save on shipping.
        </p>
        <div class="row" style={{ gap: '14px', fontSize: '12px', color: 'var(--dim)', marginTop: '8px' }}>
          <span class="row" style={{ gap: '6px' }}>
            <span class="dot" style={{ width: '8px', height: '8px', background: 'var(--red)' }} />
            running low (≤ {LOW_PCT}%)
          </span>
          <span class="row" style={{ gap: '6px' }}>
            <span class="dot" style={{ width: '8px', height: '8px', background: 'var(--accent)' }} />
            getting low (≤ {TIGHT_PCT}%)
          </span>
        </div>
      </header>

      <div class="screen__body">
        {groups.length === 0 && <div class="empty">Nothing is running low.</div>}

        {groups.map((f) => (
          <section key={f.name}>
            <div class="famhead">
              <h2>{f.name}</h2>
              <div class="famhead__sub">
                {f.items.length} {f.items.length === 1 ? 'colour' : 'colours'}
              </div>
            </div>
            {f.items.map((g) => {
              const pct = Math.round(g.openPct);
              const colour = g.low ? 'var(--red-text)' : 'var(--accent)';
              const target = g.spools.length === 1 ? `/spool/${g.spools[0].id}` : '/inventory';
              return (
                <a key={g.key} class="colourrow" href={href(target)}>
                  <Swatch hex={g.hex} hexes={g.hexes} size={28} radius={14} />
                  <span class="grow">
                    <span class="colourrow__name truncate">{g.colorName}</span>
                    <span class="colourrow__sub truncate">
                      {g.brand} · {g.material}
                    </span>
                  </span>
                  <span class="row" style={{ gap: '8px', flexShrink: 0 }}>
                    <span style={{ width: '48px', height: '5px', borderRadius: '3px', background: 'var(--surface-3)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.max(Math.min(pct, 100), 4)}%`, background: g.low ? 'var(--red)' : 'var(--accent)' }} />
                    </span>
                    <span class="mono" style={{ fontSize: '12.5px', width: '38px', textAlign: 'right', color: colour }}>
                      {pct}%
                    </span>
                  </span>
                </a>
              );
            })}
          </section>
        ))}
      </div>

      {groups.length > 0 && (
        <div class="screen__foot">
          <button type="button" class="btn btn--block" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy list'}
          </button>
        </div>
      )}
    </div>
  );
}
