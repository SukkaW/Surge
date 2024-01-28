/**
 * Suffix Trie based on Mnemonist Trie
 */

// import { Trie } from 'mnemonist';

export const SENTINEL = Symbol('SENTINEL');

type TrieNode = {
  [SENTINEL]: boolean,
  [Bun.inspect.custom]: () => string
} & Map<string, TrieNode>;

const deepTrieNodeToJSON = (node: TrieNode) => {
  const obj: Record<string, any> = {};
  if (node[SENTINEL]) {
    obj['[start]'] = node[SENTINEL];
  }
  node.forEach((value, key) => {
    obj[key] = deepTrieNodeToJSON(value);
  });
  return obj;
};

const createNode = (): TrieNode => {
  const node = new Map<string, TrieNode>() as TrieNode;
  node[SENTINEL] = false;
  node[Bun.inspect.custom] = () => JSON.stringify(deepTrieNodeToJSON(node), null, 2);
  return node;
};

export const createTrie = (from?: string[] | Set<string> | null) => {
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
    }
    node[SENTINEL] = true;
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

    do {
      const suffix: string = suffixStack.pop()!;
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
    } while (nodeStack.length);

    return matches;
  };

  /**
   * Works like trie.find, but instead of returning the matches as an array, it removes them from the given set in-place.
   */
  const substractSetInPlaceFromFound = (inputSuffix: string, set: Set<string>) => {
    let node: TrieNode | undefined = root;
    let token: string;

    // Find the leaf-est node, and early return if not any
    for (let i = inputSuffix.length - 1; i >= 0; i--) {
      token = inputSuffix[i];

      node = node.get(token);
      if (!node) {
        return;
      }
    }

    // Performing DFS from prefix
    const nodeStack: TrieNode[] = [node];
    const suffixStack: string[] = [inputSuffix];

    do {
      const suffix = suffixStack.pop()!;
      node = nodeStack.pop()!;

      if (node[SENTINEL]) {
        if (suffix !== inputSuffix) {
          // found match, delete it from set
          set.delete(suffix);
        }
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);
        suffixStack.push(k + suffix);
      });
    } while (nodeStack.length);
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

  if (Array.isArray(from)) {
    for (let i = 0, l = from.length; i < l; i++) {
      add(from[i]);
    }
  } else if (from) {
    from.forEach(add);
  }

  const dump = () => {
    const node = root;
    const nodeStack: TrieNode[] = [];
    const suffixStack: string[] = [];
    // Resolving initial string
    const suffix = '';

    nodeStack.push(node);
    suffixStack.push(suffix);

    const results: string[] = [];

    let currentNode: TrieNode;
    let currentPrefix: string;
    let hasValue = false;

    do {
      currentNode = nodeStack.pop()!;
      currentPrefix = suffixStack.pop()!;

      if (currentNode[SENTINEL]) {
        hasValue = true;
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);
        suffixStack.push(k + suffix);
      });

      if (hasValue) results.push(currentPrefix);
    } while (nodeStack.length);

    return results;
  };

  return {
    add,
    contains,
    find,
    substractSetInPlaceFromFound,
    remove,
    delete: remove,
    has,
    dump,
    get size() {
      return size;
    },
    get root() {
      return root;
    },
    [Bun.inspect.custom]: () => JSON.stringify(deepTrieNodeToJSON(root), null, 2)
  };
};

export default createTrie;
