import type { JSX } from 'preact';
import { href } from '../lib/router';
import { canEdit, useApp } from '../lib/store';
import { relativeTime } from '../lib/util';
import { Icon, type IconName } from './ui';

type Section = 'printers' | 'inventory' | 'add' | 'manage' | 'sync' | null;

function sectionOf(path: string): Section {
  if (path === '/') return 'printers';
  if (path === '/inventory' || path === '/reorder' || path.startsWith('/spool/') || path.startsWith('/recolor/')) return 'inventory';
  if (path === '/add') return 'add';
  if (path === '/printers' || path.startsWith('/printer/') || path.startsWith('/load/')) return 'manage';
  if (path === '/connect') return 'sync';
  return null;
}

/**
 * Navigation for screens wider than a phone. The phone keeps its tab bar; CSS
 * shows one or the other, so there is no breakpoint logic here. Below 1100px it
 * is an icon rail, above it the labels appear.
 */
export function Sidebar({ path }: { path: string }): JSX.Element {
  const app = useApp();
  const writable = canEdit(app);
  const { online, syncing, pending, lastSync } = app;
  const active = sectionOf(path);

  const syncLabel = !online ? 'Offline' : syncing ? 'Saving' : pending > 0 ? `${pending} to push` : 'Synced';
  const syncTone = !online ? 'var(--faint)' : pending > 0 || syncing ? 'var(--accent)' : 'var(--green)';

  const item = (id: Section, to: string, label: string, icon: IconName): JSX.Element => (
    <a class="sidebar__item" href={href(to)} data-active={active === id} aria-label={label} title={label}>
      <Icon name={icon} size={20} />
      <span class="sidebar__label">{label}</span>
    </a>
  );

  return (
    <nav class="sidebar" aria-label="Main">
      <a class="sidebar__brand" href={href('/')} aria-label="Spoolhive">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        <span class="sidebar__label">Spoolhive</span>
      </a>

      {item('printers', '/', 'Printers', 'printer')}
      {item('inventory', '/inventory', 'Inventory', 'spool')}

      {writable && (
        <a class="sidebar__add" href={href('/add')} aria-label="Add spool" title="Add spool">
          <Icon name="plus" size={18} />
          <span class="sidebar__label">Add spool</span>
        </a>
      )}

      <div class="grow" />

      {item('manage', '/printers', writable ? 'Manage printers' : 'All printers', 'printer')}
      {/* Syncing is automatic; this only shows its state, and is where the token is entered to allow edits. */}
      <a class="sidebar__status" href={href('/connect')} data-active={active === 'sync'} aria-label={`${syncLabel}. Sync settings`} title={`Last synced ${relativeTime(lastSync)}`}>
        <span class="dot" style={{ background: syncTone }} />
        <span class="sidebar__label">{syncLabel}</span>
      </a>
    </nav>
  );
}
