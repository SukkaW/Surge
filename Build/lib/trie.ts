/**
 * Suffix Trie based on Mnemonist Trie
 */

export const SENTINEL = Symbol('SENTINEL');

type TrieNode = {
  [SENTINEL]: boolean
} & Map<string, TrieNode>;

const createNode = (): TrieNode => {
  const map = new Map<string, TrieNode>();
  const node = map as TrieNode;
  node[SENTINEL] = false;
  return node;
};

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

      if (node.has(token)) {
        node = node.get(token)!;
      } else {
        const newNode = createNode();
        node.set(token, newNode);
        node = newNode;
      }
    }

    // Do we need to increase size?
    if (!node[SENTINEL]) {
      size++;
      node[SENTINEL] = true;
    }
  };

  /**
   * @param {string} suffix
   */
  const contains = (suffix: string): boolean => {
    let node: TrieNode | undefined = root;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      node = node.get(token);
      if (!node) {
        return false;
      }
    }

    return true;
  };
  /**
   * Method used to retrieve every item in the trie with the given prefix.
   */
  const find = (inputSuffix: string, /** @default true */ includeEqualWithSuffix = true): string[] => {
    let node: TrieNode | undefined = root;
    let token: string;

    for (let i = inputSuffix.length - 1; i >= 0; i--) {
      token = inputSuffix[i];

      node = node.get(token);
      if (!node) {
        return [];
      }
    }

    const matches: string[] = [];

    // Performing DFS from prefix
    const nodeStack: TrieNode[] = [node];
    const suffixStack: string[] = [inputSuffix];

    while (nodeStack.length) {
      const suffix = suffixStack.pop()!;
      node = nodeStack.pop()!;

      if (node[SENTINEL]) {
        if (includeEqualWithSuffix || suffix !== inputSuffix) {
          matches.push(suffix);
        }
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);
        suffixStack.push(k + suffix);
      });
    }

    return matches;
  };

  /**
   * Method used to delete a prefix from the trie.
   */
  const remove = (suffix: string): boolean => {
    let node: TrieNode | undefined = root;
    let toPrune: TrieNode | null = null;
    let tokenToPrune: string | null = null;
    let parent: TrieNode = node;
    let token: string;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      parent = node;

      node = node.get(token);
      if (!node) {
        return false;
      }

      // Keeping track of a potential branch to prune
      // If the node is to be pruned, but they are more than one token child in it, we can't prune it
      // If there is only one token child, or no child at all, we can prune it safely

      const onlyChild = node.size === 1 && node.has(token);

      if (onlyChild) {
        toPrune = parent;
        tokenToPrune = token;
      } else if (toPrune !== null) { // not only child, retain the branch
        toPrune = null;
        tokenToPrune = null;
      }
    }

    if (!node[SENTINEL]) return false;

    size--;

    if (tokenToPrune && toPrune) {
      toPrune.delete(tokenToPrune);
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

      if (node.has(token)) {
        node = node.get(token)!;
      } else {
        return false;
      }
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
