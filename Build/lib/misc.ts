export const isTruthy = <T>(i: T | 0 | '' | false | null | undefined): i is T => !!i;

export const fastStringArrayJoin = (arr: string[], sep: string) => {
  let result = '';
  for (let i = 0, len = arr.length; i < len; i++) {
    if (i !== 0) {
      result += sep;
    }
    result += arr[i];
  }
  return result;
};

export const fastStringArrayJoin2 = (arr: string[], sep: string) => {
  return arr.reduce((acc, cur, index) => {
    return index === 0 ? cur : acc + sep + cur;
  }, '');
};
