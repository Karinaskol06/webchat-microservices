import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` after `delayMs` milliseconds without changes.
 */
export function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
