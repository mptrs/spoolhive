import { useEffect, useState } from 'preact/hooks';

function current(): string {
  const hash = location.hash.replace(/^#/, '');
  const path = hash.split('?')[0];
  return path.startsWith('/') ? path : '/';
}

/** Query string after the hash route, e.g. `#/add?printer=abc`. */
export function query(): URLSearchParams {
  const hash = location.hash.replace(/^#/, '');
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

/**
 * How deep we are in this app's own history. Every entry we create is stamped
 * with an index, so Back can tell "there is a screen of ours to return to" from
 * "this was the first screen" (a deep link, a reload into an edit screen) -
 * `history.length` cannot, it also counts whatever the tab visited before us.
 */
let depth = 0;

function stamp(): void {
  const s = history.state as { depth?: number } | null;
  if (typeof s?.depth === 'number') {
    depth = s.depth; // Back or Forward onto an entry we already stamped
    return;
  }
  // A fresh entry: a link click or hash edit. The very first load starts at 0.
  depth = stamped ? depth + 1 : 0;
  stamped = true;
  history.replaceState({ depth }, '');
}
let stamped = false;
stamp();
addEventListener('hashchange', stamp);

export function useRoute(): string {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onChange = (): void => setPath(current());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string, { replace = false } = {}): void {
  if (!replace) {
    location.hash = to;
    return;
  }
  // Keep the depth: a replaced entry sits where the old one did.
  history.replaceState({ depth }, '', `#${to}`);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

export function href(to: string): string {
  return `#${to}`;
}

/**
 * Return to the previous screen. Only when there is none of ours to return to
 * does it go to `fallback` - and then by replacing, so Back cannot bounce
 * between the two. Never push a "back" link: that is what made Back loop.
 */
export function back(fallback = '/'): void {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

/** `/spool/:id` against `/spool/abc` yields `{ id: 'abc' }`, or null if it does not match. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}
