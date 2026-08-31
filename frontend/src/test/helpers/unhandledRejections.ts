/**
 * Records any promise rejection that escapes the app while the tracker is armed.
 *
 * Apollo v4's `useMutation` attaches a no-op `.catch()` to the promise it returns,
 * but every mutation hook here wraps `mutate()` in its own `async function` — a
 * derived promise Apollo never guards — and react-hook-form's `handleSubmit`
 * re-throws whatever the submit handler throws. Without a `try/catch` (submit) or
 * `.catch()` (delete) in the organism, a failing mutation therefore surfaces as an
 * unhandled rejection. These tests assert that it does not.
 */
export function trackUnhandledRejections() {
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    seen.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);

  return {
    seen,
    /** Lets Node reach the checkpoint where it reports unhandled rejections. */
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.off('unhandledRejection', onUnhandled);
      return seen;
    },
  };
}
