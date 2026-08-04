import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value. Used for the search box so typing does not
 * push one history entry (and one query) per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
