import type { ComponentChildren, JSX } from 'preact';
import { href, back as goBack } from '../lib/router';
import { isPale } from '../lib/catalog';
import { canEdit, useApp } from '../lib/store';

/**
 * A dual-colour silk is two colours side by side on the spool, so it is drawn
 * as hard bands rather than a blend - a blend would invent a colour that is
 * not on the reel.
 */
export function swatchBackground(hex: string, hexes?: string[]): string {
  if (!hexes || hexes.length < 2) return hex;
  const step = 100 / hexes.length;
  const stops = hexes.map((h, i) => `${h} ${i * step}% ${(i + 1) * step}%`).join(', ');
  return `linear-gradient(135deg, ${stops})`;
}

export function Swatch({
  hex,
  hexes,
  size = 38,
  radius,
}: {
  hex: string;
  hexes?: string[];
  size?: number;
  radius?: number;
}): JSX.Element {
  return (
    <span
      class="swatch"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: swatchBackground(hex, hexes),
        borderRadius: `${radius ?? Math.round(size / 3.5)}px`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,${isPale(hex) ? 0.35 : 0.18})`,
      }}
    />
  );
}

/**
 * A spool seen from the side: the coloured ring is the filament still on it,
 * thick when full and thin when nearly gone. A refill on a reusable spool shows
 * that spool's core in the middle. A thin light edge keeps black filament
 * visible against the dark tile.
 */
export function SpoolDisc({
  hex,
  hexes,
  pct,
  reusable = false,
  size = 36,
}: {
  hex: string;
  hexes?: string[];
  pct: number;
  reusable?: boolean;
  size?: number;
}): JSX.Element {
  const c = size / 2;
  const outer = c - 1;
  const hub = outer * (reusable ? 0.38 : 0.3);
  const filled = hub + (outer - hub) * (Math.max(0, Math.min(100, pct)) / 100);
  const width = filled - hub;
  const mid = (hub + filled) / 2;
  const colours = hexes && hexes.length > 1 ? hexes : [hex];
  const around = 2 * Math.PI * mid;
  const part = around / colours.length;

  return (
    <svg class="spooldisc" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={outer - 0.5} fill="none" stroke="var(--surface-3)" stroke-width="1" />
      {width > 0.3 &&
        colours.map((h, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={mid}
            fill="none"
            stroke={h}
            stroke-width={width}
            stroke-dasharray={colours.length > 1 ? `${part} ${around}` : undefined}
            stroke-dashoffset={colours.length > 1 ? -i * part : undefined}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ))}
      {width > 0.3 && <circle cx={c} cy={c} r={filled} fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1" />}
      {reusable ? (
        // The core as a ring, so its hole shows whatever the tile is.
        <circle cx={c} cy={c} r={hub * 0.7} fill="none" stroke="var(--faint)" stroke-width={hub * 0.6} />
      ) : (
        <circle cx={c} cy={c} r={hub} fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1" />
      )}
    </svg>
  );
}

export function Bar({ pct }: { pct: number }): JSX.Element {
  const color = pct <= 15 ? 'var(--red)' : pct <= 30 ? 'var(--accent)' : 'var(--green)';
  return (
    <span class="bar">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}

export function pctColor(pct: number): string {
  return pct <= 15 ? 'var(--red-text)' : pct <= 30 ? 'var(--accent)' : 'var(--text-2)';
}

export function BackButton({
  to,
  label,
  onBack,
}: {
  /** Where to land if there is no previous screen (a deep link or reload). */
  to?: string;
  label: string;
  /** For going back a step inside one screen, where the URL does not change. */
  onBack?: () => void;
}): JSX.Element {
  if (onBack) {
    return (
      <button type="button" class="iconbtn" aria-label={label} onClick={onBack}>
        <Icon name="chevronLeft" />
      </button>
    );
  }
  return (
    <a
      class="iconbtn"
      href={to ? href(to) : '#'}
      aria-label={label}
      onClick={(e) => {
        // `to` is where to land when there is nothing to go back to. Following
        // it as a plain link would push a new entry and trap Back in a loop.
        e.preventDefault();
        goBack(to);
      }}
    >
      <Icon name="chevronLeft" />
    </a>
  );
}

export function Note({
  tone = 'quiet',
  icon = 'info',
  children,
}: {
  tone?: 'quiet' | 'warn' | 'bad' | 'ok';
  icon?: IconName;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <div class={`note note--${tone}`}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

export type IconName =
  | 'printer'
  | 'loaded'
  | 'spool'
  | 'plus'
  | 'minus'
  | 'chevronLeft'
  | 'chevronRight'
  | 'gear'
  | 'warn'
  | 'info'
  | 'lock'
  | 'check'
  | 'search'
  | 'offline'
  | 'github'
  | 'eject'
  | 'trash';

const PATHS: Record<IconName, JSX.Element> = {
  printer: (
    <>
      {/* An enclosed FDM printer: frame, gantry, nozzle, print on the bed. */}
      <rect x="3.5" y="3" width="17" height="18" rx="2" />
      <path d="M3.5 7.5h17" />
      <path d="M10 7.5v2.5h4V7.5M12 10v2" />
      <path d="M7 17h10" />
      <path d="M9.5 17v-2h5v2" />
    </>
  ),
  /** A spool sitting in a printer: the mark the inventory uses for "loaded". */
  loaded: (
    <>
      <rect x="4" y="3" width="16" height="9" rx="2" />
      <path d="M7 12v4h10v-4M8 21h8M12 16v5" />
    </>
  ),
  spool: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  warn: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  offline: (
    <>
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M8.5 16.1a6 6 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="m2 2 20 20" />
    </>
  ),
  github: (
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  ),
  eject: (
    <>
      <path d="M12 5 5 14h14z" />
      <path d="M5 18.5h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }): JSX.Element {
  const filled = name === 'github';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function TabBar({ active }: { active: 'printers' | 'inventory' | 'add' }): JSX.Element {
  const writable = canEdit(useApp());
  const tabs: Array<{ id: typeof active; to: string; label: string; icon: IconName }> = [
    { id: 'printers', to: '/', label: 'Printers', icon: 'printer' },
    { id: 'inventory', to: '/inventory', label: 'Inventory', icon: 'spool' },
    // Without a token there is nothing to add to.
    ...(writable ? [{ id: 'add' as const, to: '/add', label: 'Add', icon: 'plus' as const }] : []),
  ];
  return (
    <nav class="tabbar">
      {tabs.map((t) => (
        <a key={t.id} href={href(t.to)} data-active={t.id === active}>
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

