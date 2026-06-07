/**
 * Create a debounced version of a function.
 * Only the last call within the delay window is executed.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}
