/**
 * In-place adding of elements from an array to a set.
 */
export function setAddFromArray<T>(set: Set<T>, arr: T[]): void {
  for (let i = 0, len = arr.length; i < len; i++) {
    set.add(arr[i]);
  }
}
