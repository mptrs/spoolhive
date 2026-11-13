import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { canEdit, useApp } from '../lib/store';
import { back, href } from '../lib/router';
import { bagsInUse, canBag, freeBags, isLoaded, locationText, needsSpool, remainingGrams } from '../lib/types';
import { BackButton, Icon, Note, Swatch } from '../components/ui';
import { deleteSpool, markEmpty, mountRefill, recordPrint, returnEmptySpool, setInBag, setSealed, unloadSpool } from '../lib/actions';
import { shortDate } from '../lib/util';

function levelColour(pct: number): string {
  return pct <= 15 ? 'var(--red)' : pct <= 30 ? 'var(--accent)' : 'var(--green)';
}

export function SpoolDetail({ id, embedded = false }: { id: string; embedded?: boolean }): JSX.Element {
  const app = useApp();
  const { inv } = app;
  const writable = canEdit(app);
  const spool = inv.spools.find((s) => s.id === id);
  const [grams, setGrams] = useState('');
  const [lastPrint, setLastPrint] = useState<number | null>(null);
  // A regular spool that just ran out: only the user knows whether its spool is reusable.
  const [askReusable, setAskReusable] = useState(false);

  if (!spool) {
    return (
      <div class={embedded ? 'screen screen--embedded' : 'screen'}>
        {!embedded && (
          <header class="topbar">
            <BackButton to="/inventory" label="Back to inventory" />
            <div class="topbar__title">Spool</div>
          </header>
        )}
        <div class="screen__body">
          <div class="empty">That spool is no longer in the inventory.</div>
        </div>
      </div>
    );
  }

  const pct = spool.remainingPct;
  const used = Number(grams);
  const canSubtract = used > 0 && Number.isFinite(used);
  const grounded = needsSpool(spool);
  // A refill always sits on a reusable spool, which goes back to the pool by itself.
  const asksOnEmpty = spool.form === 'spool' && pct > 0;

  const submit = (e: Event): void => {
    e.preventDefault();
    if (!canSubtract) return;
    const runsOut = spool.netWeightG > 0 && remainingGrams(spool) - used < spool.netWeightG / 200;
    recordPrint(spool.id, used);
    if (asksOnEmpty && runsOut) setAskReusable(true);
    setLastPrint(used);
    setGrams('');
  };

  return (
    <div class={embedded ? 'screen screen--embedded' : 'screen'}>
      {!embedded && (
        <header class="topbar">
          <BackButton to="/inventory" label="Back" />
          <div class="topbar__title">Spool</div>
        </header>
      )}

      <div class="screen__body" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div class="row" style={{ gap: '14px' }}>
          <Swatch hex={spool.hex} hexes={spool.hexes} size={48} radius={24} />
          <div class="grow">
            <h1 style={{ margin: 0, fontSize: '24px', lineHeight: 1.15 }}>{spool.colorName}</h1>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>
              {spool.brand} · {spool.material}
            </div>
          </div>
        </div>

        <div class="stack" style={{ gap: '10px' }}>
          <div class="row" style={{ alignItems: 'baseline' }}>
            <span class="mono" style={{ fontSize: '34px', fontWeight: 500, color: spool.sealed ? 'var(--green-text)' : levelColour(pct) }}>
              {pct}%
            </span>
            <span style={{ fontSize: '14px', color: 'var(--dim)' }}>
              {spool.sealed ? 'sealed, full' : `≈ ${remainingGrams(spool)} g left`}
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: spool.sealed ? 'var(--green)' : levelColour(pct) }} />
          </div>
        </div>

        {writable && (
          <form class="stack" style={{ gap: '8px' }} onSubmit={submit}>
            <label class="label" for="used">
              Print done
            </label>
            <div class="printdone">
              <div class="printdone__field">
                <input
                  id="used"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="Weight from Bambu Studio"
                  value={grams}
                  onInput={(e) => setGrams((e.target as HTMLInputElement).value)}
                />
                <span style={{ color: 'var(--faint)', fontSize: '14px' }}>g</span>
              </div>
              <button type="submit" class="printdone__go" aria-label="Subtract from spool" disabled={!canSubtract}>
                <Icon name="check" size={22} />
              </button>
            </div>
            {lastPrint !== null && <span class="muted" style={{ fontSize: '12px' }}>Last print: −{lastPrint} g</span>}
          </form>
        )}

        <div class="detailrows">
          {isLoaded(spool) ? (
            <div class="detailrow">
              <span style={{ color: 'var(--accent)', display: 'flex' }}>
                <Icon name="loaded" />
              </span>
              <span class="grow">{locationText(inv, spool.location)}</span>
              {writable && (
                <button type="button" class="btn btn--ghost btn--row" onClick={() => unloadSpool(spool.id)}>
                  Take out
                </button>
              )}
            </div>
          ) : (
            <div class="detailrow">
              <Icon name="spool" />
              <span class="grow">{locationText(inv, spool.location)}</span>
            </div>
          )}

          <div class="detailrow">
            <Icon name="lock" />
            <span class="grow">{spool.sealed ? 'Sealed' : 'Opened'}</span>
            {!spool.sealed && spool.openedAt && <span class="detailrow__aside">since {shortDate(spool.openedAt)}</span>}
            {/* A refill without a spool is opened by mounting it, below. */}
            {writable && spool.sealed && !grounded && (
              <button type="button" class="btn btn--ghost btn--row" onClick={() => setSealed(spool.id, false)}>
                Open it
              </button>
            )}
          </div>

          {spool.form === 'refill' && (
            <div class="detailrow">
              <Icon name="spool" />
              <span class="grow">
                {spool.mounted ? 'Refill on a reusable spool' : grounded ? 'Refill, no spool yet' : 'Refill'}
                {writable && grounded && (
                  <span class="muted" style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>
                    {inv.emptySpools === 0
                      ? 'No empty spool free'
                      : `${inv.emptySpools} empty ${inv.emptySpools === 1 ? 'spool' : 'spools'} free`}
                  </span>
                )}
              </span>
              {writable && grounded && (
                <button type="button" class="btn btn--ghost btn--row" disabled={inv.emptySpools === 0} onClick={() => mountRefill(spool.id)}>
                  Mount on spool
                </button>
              )}
            </div>
          )}

          {canBag(spool) && (
            <label class="detailrow" style={{ cursor: writable ? 'pointer' : undefined }}>
              <Icon name="lock" />
              <span class="grow">
                In resealable bag
                {!spool.inBag && (
                  <span class="muted" style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>
                    {freeBags(inv) === 0
                      ? (inv.resealBags ?? 0) === 0
                        ? 'No bags yet — set how many you own under Manage printers'
                        : `All ${bagsInUse(inv)} bags are in use`
                      : `${freeBags(inv)} of ${inv.resealBags} ${inv.resealBags === 1 ? 'bag' : 'bags'} free`}
                  </span>
                )}
              </span>
              <input
                type="checkbox"
                checked={Boolean(spool.inBag)}
                disabled={!writable || (!spool.inBag && freeBags(inv) === 0)}
                onChange={(e) => setInBag(spool.id, (e.target as HTMLInputElement).checked)}
                style={{ width: '22px', height: '22px', accentColor: 'var(--accent)' }}
              />
            </label>
          )}

          {writable && (
            <a class="detailrow" href={href(`/recolor/${spool.id}`)}>
              <Icon name="spool" />
              <span class="grow">Change colour</span>
              <Icon name="chevronRight" size={16} />
            </a>
          )}
        </div>

        {writable && askReusable && (
          <Note>
            <span style={{ display: 'block' }}>This spool is empty. Was it on a reusable spool?</span>
            <span class="row" style={{ gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                class="btn btn--row"
                onClick={() => {
                  returnEmptySpool();
                  setAskReusable(false);
                }}
              >
                Yes, keep the spool
              </button>
              <button type="button" class="btn btn--ghost btn--row" onClick={() => setAskReusable(false)}>
                No
              </button>
            </span>
          </Note>
        )}

        {writable && (
          <div class="row" style={{ gap: '9px', marginTop: 'auto' }}>
            <button
              type="button"
              class="btn btn--ghost grow"
              onClick={() => {
                markEmpty(spool.id);
                if (asksOnEmpty) setAskReusable(true);
              }}
            >
              Mark empty
            </button>
            <button
              type="button"
              class="btn btn--danger grow"
              onClick={() => {
                if (confirm(`Remove ${spool.colorName} from the inventory?`)) {
                  deleteSpool(spool.id);
                  back('/inventory');
                }
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
