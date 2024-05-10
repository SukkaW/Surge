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

function trieNodeInspectCustom(this: TrieNode) {
  return JSON.stringify(deepTrieNodeToJSON(this), null, 2);
}

const createNode = (): TrieNode => {
  const node = new Map<string, TrieNode>() as TrieNode;
  node[SENTINEL] = false;
  node[Bun.inspect.custom] = trieNodeInspectCustom;
  return node;
};

export const createTrie = (from?: string[] | Set<string> | null, hostnameMode = false) => {
  let size = 0;
  const root: TrieNode = createNode();

  const suffixToTokens = hostnameMode
    ? (suffix: string) => {
      let buf = '';
      const tokens: string[] = [];
      for (let i = 0, l = suffix.length; i < l; i++) {
        const c = suffix[i];
        if (c === '.') {
          if (buf) {
            tokens.push(buf, /* . */ c);
            buf = '';
          } else {
            tokens.push(/* . */ c);
          }
        } else {
          buf += c;
        }
      }
      if (buf) {
        tokens.push(buf);
      }
      return tokens;
    }
    : (suffix: string) => suffix;

  /**
   * Method used to add the given prefix to the trie.
   */
  const add = (suffix: string): void => {
    let node: TrieNode = root;
    let token: string;

    const tokens = suffixToTokens(suffix);

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

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
   * @param {string} $suffix
   */
  const contains = (suffix: string): boolean => {
    let node: TrieNode | undefined = root;
    let token: string;

    const tokens = suffixToTokens(suffix);

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      node = node.get(token);
      if (!node) return false;
    }

    return true;
  };
  /**
   * Method used to retrieve every item in the trie with the given prefix.
   */
  const find = (inputSuffix: string, /** @default true */ includeEqualWithSuffix = true): string[] => {
    let node: TrieNode | undefined = root;
    let token: string;

    const inputTokens = suffixToTokens(inputSuffix);

    for (let i = inputTokens.length - 1; i >= 0; i--) {
      token = inputTokens[i];

      if (hostnameMode && token === '') {
        break;
      }

      node = node.get(token);
      if (!node) return [];
    }

    const matches: Array<string | string[]> = [];

    // Performing DFS from prefix
    const nodeStack: TrieNode[] = [node];
    const suffixStack: Array<string | string[]> = [inputTokens];

    do {
      const suffix: string | string[] = suffixStack.pop()!;
      node = nodeStack.pop()!;

      if (node[SENTINEL]) {
        if (includeEqualWithSuffix) {
          matches.push(suffix);
        } else if (hostnameMode) {
          if ((suffix as string[]).some((t, i) => t !== inputTokens[i])) {
            matches.push(suffix);
          }
        } else if (suffix !== inputTokens) {
          matches.push(suffix);
        }
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);

        if (hostnameMode) {
          const stack = (suffix as string[]).slice();
          stack.unshift(k);

          suffixStack.push(stack);
        } else {
          suffixStack.push(k + (suffix as string));
        }
      });
    } while (nodeStack.length);

    return hostnameMode ? matches.map((m) => (m as string[]).join('')) : matches as string[];
  };

  /**
 * Works like trie.find, but instead of returning the matches as an array, it removes them from the given set in-place.
 */
  const substractSetInPlaceFromFound = (inputSuffix: string, set: Set<string>) => {
    let node: TrieNode | undefined = root;
    let token: string;

    const inputTokens = suffixToTokens(inputSuffix);

    // Find the leaf-est node, and early return if not any
    for (let i = inputTokens.length - 1; i >= 0; i--) {
      token = inputTokens[i];

      node = node.get(token);
      if (!node) return;
    }

    // Performing DFS from prefix
    const nodeStack: TrieNode[] = [node];
    const suffixStack: Array<string | string[]> = [inputTokens];

    do {
      const suffix = suffixStack.pop()!;
      node = nodeStack.pop()!;

      if (node[SENTINEL]) {
        if (suffix !== inputTokens) {
        // found match, delete it from set
          if (hostnameMode) {
            set.delete((suffix as string[]).join(''));
          } else {
            set.delete(suffix as string);
          }
        }
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);
        if (hostnameMode) {
          const stack = (suffix as string[]).slice();
          stack.unshift(k);
          suffixStack.push(stack);
        } else {
          suffixStack.push(k + (suffix as string));
        }
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

    const suffixTokens = suffixToTokens(suffix);

    for (let i = suffixTokens.length - 1; i >= 0; i--) {
      token = suffixTokens[i];
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

    const tokens = suffixToTokens(suffix);

    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];

      if (!node.has(token)) {
        return false;
      }

      node = node.get(token)!;
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
