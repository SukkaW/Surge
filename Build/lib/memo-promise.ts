const notError = Symbol('notError');

export const createMemoizedPromise = <T>(fn: () => Promise<T>, preload = true): () => Promise<T> => {
  let error: Error | typeof notError = notError;

  let promise: Promise<T> | null = preload
    ? fn().catch(e => {
      // Here we record the error so that we can throw it later when the function is called
      error = e;
      // Here we make sure the Promise still returns the never type
      throw e;
    })
    : null;

  return () => {
    if (error !== notError) {
      return Promise.reject(error);
    }
    promise ??= fn();
    return promise;
  };
};
