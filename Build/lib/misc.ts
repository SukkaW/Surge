export const isTruthy = <T>(i: T | 0 | '' | false | null | undefined): i is T => !!i;
