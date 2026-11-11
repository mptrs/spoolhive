import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Wide enough for the inventory list and a spool beside it. Keep in step with the 1100px breakpoint in styles.css. */
export const WIDE_QUERY = '(min-width: 1100px)';

export function useWide(): boolean {
  const [wide, setWide] = useState(() => matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY);
    const onChange = (): void => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/**
 * Publishes a sticky header's height on its screen as --header-h, so headings
 * further down can stick just under it. It changes as the header wraps or
 * gains a bar, hence the observer.
 */
export function useHeaderHeight<T extends HTMLElement>(): { current: T | null } {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const header = ref.current;
    const screen = header?.parentElement;
    if (!header || !screen) return;
    const update = (): void => screen.style.setProperty('--header-h', `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return ref;
}
