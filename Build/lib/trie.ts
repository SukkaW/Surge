/**
 * Suffix Trie based on Mnemonist Trie
 */

export const SENTINEL = '\u0000';

type TrieNode = {
  [SENTINEL]?: true
} & {
  [key: string & {}]: TrieNode | undefined
};

// type TrieNode = Map<typeof SENTINEL | string & {}, TrieNode | true | undefined>;

/**
 * @param {string[] | Set<string>} [from]
 */
export const createTrie = (from?: string[] | Set<string>) => {
  let size = 0;
  const root: TrieNode = {};

  /**
   * Method used to add the given prefix to the trie.
   *
   * @param  {string} suffix - Prefix to follow.
   */
  const add = (suffix: string): void => {
    let node: TrieNode = root;
    let token: string;
    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      node[token] ||= {};
      node = node[token]!;
    }

    // Do we need to increase size?
    if (!(SENTINEL in node)) {
      size++;
    }
    node[SENTINEL] = true;
  };

  /**
   * @param {string} suffix
   */
  const contains = (suffix: string): boolean => {
    let node: TrieNode = root;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      const n = node[token];
      if (n === undefined) return false;
      // if (n === true) return false;

      node = n;
    }

    return true;
  };
  /**
   * Method used to retrieve every item in the trie with the given prefix.
   *
   * @param  {string} suffix - Prefix to query.
   * @param  {boolean} [includeEqualWithSuffix]
   * @return {string[]}
   */
  const find = (suffix: string, includeEqualWithSuffix = true): string[] => {
    let node: TrieNode = root;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      const n = node[token];
      if (n === undefined) return [];
      // if (n === true) return [];

      node = n;
    }

    const matches: string[] = [];

    // Performing DFS from prefix
    const nodeStack: TrieNode[] = [node];

    const suffixStack: string[] = [suffix];
    let k: string;

    let $suffix: string = suffix;

    while (nodeStack.length) {
      $suffix = suffixStack.pop()!;
      node = nodeStack.pop()!;

      // eslint-disable-next-line guard-for-in -- plain object
      for (k in node) {
        if (k === SENTINEL) {
          if (includeEqualWithSuffix || $suffix !== suffix) {
            matches.push($suffix);
          }

          continue;
        }

        nodeStack.push(node[k]!);
        suffixStack.push(k + $suffix);
      }
    }

    return matches;
  };

  /**
   * Method used to delete a prefix from the trie.
   *
   * @param  {string} suffix - Prefix to delete.
   * @return {boolean}
   */
  const remove = (suffix: string): boolean => {
    let node: TrieNode = root;
    let toPrune: TrieNode | null = null;
    let tokenToPrune: string | null = null;
    let parent: TrieNode = node;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      parent = node;

      const n = node[token];
      // Prefix does not exist
      if (n === undefined) return false;
      // if (n === true) return false

      node = n;

      // Keeping track of a potential branch to prune
      // If the node is to be pruned, but they are more than one token child in it, we can't prune it
      // If there is only one token child, or no child at all, we can prune it safely

      let onlyChild = true;
      for (const k in node) {
        if (k !== token) {
          onlyChild = false;
          break;
        }
      }

      if (toPrune !== null) {
        if (!onlyChild) {
          toPrune = null;
          tokenToPrune = null;
        }
      } else if (onlyChild) {
        toPrune = parent;
        tokenToPrune = token;
      }
    }

    if (!(SENTINEL in node)) return false;

    size--;

    if (tokenToPrune && toPrune) {
      delete toPrune[tokenToPrune];
    } else {
      delete node[SENTINEL];
    }

    return true;
  };

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   *
   * @param  {string} suffix - Prefix to check.
   * @return {boolean}
   */
  const has = (suffix: string): boolean => {
    let node: TrieNode = root;

    for (let i = suffix.length - 1; i >= 0; i--) {
      const n = node[suffix[i]];
      if (n === undefined) {
        return false;
      }
      // if (n === true) return false;

      node = n;
    }

    return SENTINEL in node;
  };

  if (from) {
    from.forEach(add);
  }

  return {
    add,
    contains,
    find,
    remove,
    delete: remove,
    has,
    get size() {
      return size;
    }
  };
};

export default createTrie;
