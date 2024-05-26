/**
 * In-place adding of elements from an array to a set.
 */
export function setAddFromArray<T>(set: Set<T>, arr: T[]): void {
  // for (let i = 0, len = arr.length; i < len; i++) {
  //   set.add(arr[i]);
  // }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- thisArg is passed
  arr.forEach(set.add, set);
}

// eslint-disable-next-line @typescript-eslint/unbound-method -- thisArg is passed
export const setAddFromArrayCurried = <T>(set: Set<T>) => (arr: T[]) => arr.forEach(set.add, set);
