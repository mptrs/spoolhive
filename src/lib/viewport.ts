import { useEffect, useState } from 'preact/hooks';

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
