/**
 * Suffix Trie based on Mnemonist Trie
 */

export const SENTINEL = '\u0000';

type TrieNode = {
  [SENTINEL]: boolean
} & {
  [key: string & {}]: TrieNode | undefined
};

const createNode = (): TrieNode => ({
  [SENTINEL]: false
}) as TrieNode;

export const createTrie = (from?: string[] | Set<string>) => {
  let size = 0;
  const root: TrieNode = createNode();

  /**
   * Method used to add the given prefix to the trie.
   */
  const add = (suffix: string): void => {
    let node: TrieNode = root;
    let token: string;
    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      if (!(token in node)) {
        node[token] = createNode();
      }
      node = node[token]!; // we know it is defined
    }

    // Do we need to increase size?
    if (!node[SENTINEL]) {
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

      if (!(token in node)) return false;
      node = node[token]!; // we know it is defined
    }

    return true;
  };
  /**
   * Method used to retrieve every item in the trie with the given prefix.
   */
  const find = (suffix: string, includeEqualWithSuffix = true): string[] => {
    let node: TrieNode = root;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      if (!(token in node)) return [];
      node = node[token]!;
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

      if (node[SENTINEL]) {
        if (includeEqualWithSuffix || $suffix !== suffix) {
          matches.push($suffix);
        }
      }

      for (k in node) {
        if (k === SENTINEL) continue;
        nodeStack.push(node[k]!);
        suffixStack.push(k + $suffix);
      }
    }

    return matches;
  };

  /**
   * Method used to delete a prefix from the trie.
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

      // Prefix does not exist
      if (!(token in node)) return false;
      // if (n === true) return false
      node = node[token]!; // we know it is defined

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

    if (!node[SENTINEL]) return false;

    size--;

    if (tokenToPrune && toPrune) {
      delete toPrune[tokenToPrune];
    } else {
      node[SENTINEL] = false;
    }

    return true;
  };

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   */
  const has = (suffix: string): boolean => {
    let node: TrieNode = root;

    for (let i = suffix.length - 1; i >= 0; i--) {
      const token = suffix[i];
      if (!(token in node)) return false;
      node = node[token]!; // we know it is defined
    }

    return node[SENTINEL];
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
    },
    get root() {
      return root;
    }
  };
};

export default createTrie;
