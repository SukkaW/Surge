/**
 * Suffix Trie based on Mnemonist Trie
 */

// import { Trie } from 'mnemonist';

export const SENTINEL = Symbol('SENTINEL');
const PARENT = Symbol('Parent Node');

type TrieNode = {
  [SENTINEL]: boolean,
  [PARENT]: TrieNode | null,
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

const createNode = (parent: TrieNode | null = null): TrieNode => {
  const node = new Map<string, TrieNode>() as TrieNode;
  node[SENTINEL] = false;
  node[PARENT] = parent;
  node[Bun.inspect.custom] = trieNodeInspectCustom;
  return node;
};

export const createTrie = (from?: string[] | Set<string> | null, hostnameMode = false, smolTree = false) => {
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

        // During the adding of `[start]blog.skk.moe` and find out that there is a `[start].skk.moe` in the trie
        // Dedupe the covered subdomain by skipping
        if (smolTree && (node.get('.')?.[SENTINEL])) {
          return;
        }
      } else {
        const newNode = createNode(node);
        node.set(token, newNode);
        node = newNode;
      }

      if (smolTree) {
        // Trying to add `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie
        if (i === 1 && tokens[0] === '.') {
          // If there is a `[start]sub.example.com` here, remove it
          node[SENTINEL] = false;

          // Removing the rest of the child nodes by creating a new node and disconnecting the old one
          const newNode = createNode(node);
          node.set('.', newNode);
          node = newNode;
          break;
        }
        if (i === 0) {
          // Trying to add `example.com` when there is already a `.example.com` in the trie
          if (node.get('.')?.[SENTINEL] === true) {
            return;
          }
        }
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
    if (smolTree) {
      throw new Error('A Trie with smolTree enabled cannot perform find!');
    }

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
          suffixStack.push([k, ...suffix]);
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
    if (smolTree) {
      throw new Error('A Trie with smolTree enabled cannot perform substractSetInPlaceFromFound!');
    }

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
        // found match, delete it from set
        if (hostnameMode) {
          set.delete((suffix as string[]).join(''));
        } else if (suffix !== inputTokens) {
          set.delete(suffix as string);
        }
      }

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);
        if (hostnameMode) {
          const stack = [k, ...suffix];
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

  const dump = () => {
    const nodeStack: TrieNode[] = [];
    const suffixStack: Array<string | string[]> = [];

    nodeStack.push(root);
    // Resolving initial string (begin the start of the stack)
    suffixStack.push(hostnameMode ? [] : '');

    const results: string[] = [];

    let node: TrieNode;

    do {
      node = nodeStack.pop()!;
      const suffix = suffixStack.pop()!;

      node.forEach((childNode, k) => {
        nodeStack.push(childNode);

        if (hostnameMode) {
          suffixStack.push([k, ...suffix]);
        } else {
          suffixStack.push(k + (suffix as string));
        }
      });

      if (node[SENTINEL]) {
        results.push(hostnameMode ? (suffix as string[]).join('') : (suffix as string));
      }
    } while (nodeStack.length);

    return results;
  };

  const whitelist = (suffix: string) => {
    if (!hostnameMode && !smolTree) {
      throw new Error('whitelist method is only available in hostname mode or smolTree mode.');
    }

    let node: TrieNode | undefined = root;

    let toPrune: TrieNode | null = null;
    let tokenToPrune: string | null = null;
    let parent: TrieNode = node;

    const tokens = suffixToTokens(suffix);
    let token: string;

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];
      parent = node;

      node = node.get(token);
      if (!node) {
        return;
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

      // During the whitelist of `[start]blog.skk.moe` and find out that there is a `[start].skk.moe` in the trie
      // Dedupe the covered subdomain by skipping
      if (node.get('.')?.[SENTINEL]) {
        return;
      }

      // Trying to whitelist `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie
      if (i === 1 && tokens[0] === '.') {
        // If there is a `[start]sub.example.com` here, remove it
        node[SENTINEL] = false;

        // Removing the rest of the child nodes by creating a new node and disconnecting the old one
        const newNode = createNode(node);
        node.set('.', newNode);
        node = newNode;
        break;
      }
      if (i === 0) {
        // Trying to add `example.com` when there is already a `.example.com` in the trie
        if (node.get('.')?.[SENTINEL] === true) {
          return;
        }
      }
    }

    if (!node[SENTINEL]) return false;
    if (tokenToPrune && toPrune) {
      toPrune.delete(tokenToPrune);
    } else {
      node[SENTINEL] = false;
    }
  };

  if (Array.isArray(from)) {
    for (let i = 0, l = from.length; i < l; i++) {
      add(from[i]);
    }
  } else if (from) {
    from.forEach(add);
  }

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
      if (smolTree) {
        throw new Error('A Trie with smolTree enabled cannot have correct size!');
      }
      return size;
    },
    get root() {
      return root;
    },
    whitelist,
    [Bun.inspect.custom]: () => JSON.stringify(deepTrieNodeToJSON(root), null, 2),

    hostnameMode,
    smolTree
  };
};

export type Trie = ReturnType<typeof createTrie>;

export default createTrie;
