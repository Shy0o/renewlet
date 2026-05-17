import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DIALOG_CLEANUP_DELAY_MS = 200;

/**
 * Defer transient dialog cleanup until the close animation has started.
 *
 * This keeps existing state semantics, but avoids doing expensive cleanup work
 * in the same interaction frame that closes a Radix dialog.
 */
export function useDeferredDialogCleanup(
  cleanup: () => void,
  delayMs = DEFAULT_DIALOG_CLEANUP_DELAY_MS,
) {
  const cleanupRef = useRef(cleanup);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  const cancelCleanup = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleCleanup = useCallback(() => {
    cancelCleanup();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cleanupRef.current();
    }, delayMs);
  }, [cancelCleanup, delayMs]);

  useEffect(() => cancelCleanup, [cancelCleanup]);

  return { scheduleCleanup, cancelCleanup };
}
