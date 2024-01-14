export const createMemoizedPromise = <T>(fn: () => Promise<T>, preload = true): () => Promise<T> => {
  let promise: Promise<T> | null = null;

  if (preload) {
    promise = fn();
  }

  return () => {
    promise ??= fn();
    return promise;
  };
};
