export const createMemoizedPromise = <T>(fn: () => Promise<T>): () => Promise<T> => {
  let promise: Promise<T> | null = null;
  return () => {
    promise ||= fn();
    return promise;
  };
};
