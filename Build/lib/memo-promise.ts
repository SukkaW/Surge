export const createMemoizedPromise = <T>(fn: () => Promise<T>, preload = true): () => Promise<T> => {
  let promise: Promise<T> | null = preload ? fn() : null;

  return () => {
    promise ??= fn();
    return promise;
  };
};
