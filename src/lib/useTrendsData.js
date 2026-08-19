import { useEffect, useState } from 'react';

/**
 * Loads the dataset the app renders.
 *
 * Primary path is a runtime fetch of data/trends_data.json, which is what makes
 * "swap in real data" a file swap: overwrite that file (fetch_trends.py does)
 * and reload — no rebuild, no code change.
 *
 * If that request fails for any reason (opened from file://, a stray dev-server
 * config, an offline judge's laptop), it falls back to a bundled copy of the
 * same file so the demo still comes up. The fallback is a dynamic import, so it
 * lives in its own chunk and costs nothing on the happy path.
 */
export function useTrendsData() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}data/trends_data.json`;
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setState({ status: 'ready', data, loadedFrom: 'file' });
      } catch (fetchError) {
        try {
          const mod = await import('../../data/trends_data.json');
          if (!cancelled) setState({ status: 'ready', data: mod.default, loadedFrom: 'bundle' });
        } catch (bundleError) {
          if (!cancelled) setState({ status: 'error', error: fetchError, bundleError });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
