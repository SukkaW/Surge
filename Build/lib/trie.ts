/**
 * Suffix Trie based on Mnemonist Trie
 */

// const { Error, Bun, JSON, Symbol } = globalThis;

const SENTINEL = Symbol('SENTINEL');
const PARENT = Symbol('Parent Node');

const noop = () => { /** noop */ };

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

const hostnameToTokens = (hostname: string): string[] => {
  let buf = '';
  const tokens: string[] = [];
  for (let i = 0, l = hostname.length; i < l; i++) {
    const c = hostname[i];
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
};

export const createTrie = (from?: string[] | Set<string> | null, hostnameMode = false, smolTree = false) => {
  let size = 0;
  const root: TrieNode = createNode();

  const isHostnameMode = (_token: string | string[]): _token is string[] => hostnameMode;

  const suffixToTokens = hostnameMode
    ? hostnameToTokens
    : (suffix: string) => suffix;

  /**
   * Method used to add the given suffix to the trie.
   */
  const add = (suffix: string): void => {
    let node: TrieNode = root;
    let token: string;

    const tokens = suffixToTokens(suffix);

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      if (node.has(token)) {
        node = node.get(token)!;

        // During the adding of `[start]blog|.skk.moe` and find out that there is a `[start].skk.moe` in the trie
        // Dedupe the covered subdomain by skipping
        if (smolTree && token === '.' && node[SENTINEL]) {
          return;
        }
      } else {
        const newNode = createNode(node);
        node.set(token, newNode);
        node = newNode;
      }
    }

    // If we are in smolTree mode, we need to do something at the end of the loop
    if (smolTree) {
      if (tokens[0] === '.') {
        // Trying to add `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie

        const parent = node[PARENT]!;

        // Make sure parent `[start]sub.example.com` (without dot) is removed (SETINEL to false)
        parent[SENTINEL] = false;

        // Removing the rest of the parent's child nodes by disconnecting the old one and creating a new node
        const newNode = createNode(node);
        // The SENTINEL of this newNode will be set to true at the end of the function, so we don't need to set it here

        parent.set('.', newNode);

        // Now the real leaf-est node is the new node, change the pointer to it
        node = newNode;

        // we can use else-if here, because new node is empty, so we don't need to check the leading "."
      } else if (node.get('.')?.[SENTINEL] === true) {
        // Trying to add `example.com` when there is already a `.example.com` in the trie
        // No need to increment size and set SENTINEL to true (skip this "new" item)
        return;
      }
    } else if (!node[SENTINEL]) { // smol tree don't have size, so else-if here
      size++;
    }

    node[SENTINEL] = true;
  };

  const walkIntoLeafWithTokens = (
    tokens: string | string[],
    onLoop: (node: TrieNode, parent: TrieNode, token: string) => void = noop
  ) => {
    let node: TrieNode | undefined = root;
    let parent: TrieNode = node;

    let token: string;

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      if (hostnameMode && token === '') {
        break;
      }

      parent = node;
      node = node.get(token);
      if (!node) return null;

      onLoop(node, parent, token);
    }

    return { node, parent };
  };

  const contains = (suffix: string): boolean => {
    const tokens = suffixToTokens(suffix);
    return walkIntoLeafWithTokens(tokens) !== null;
  };

  const walk = (
    onMatches: (suffix: string | string[]) => void,
    initialNode = root,
    initialSuffix: string | string[] = hostnameMode ? [] : ''
  ) => {
    const nodeStack: TrieNode[] = [initialNode];
    // Resolving initial string (begin the start of the stack)
    const suffixStack: Array<string | string[]> = [initialSuffix];

    let node: TrieNode = root;

    do {
      node = nodeStack.pop()!;
      const suffix = suffixStack.pop()!;

      node.forEach((childNode, k) => {
        // Pushing the child node to the stack for next iteration of DFS
        nodeStack.push(childNode);

        suffixStack.push(isHostnameMode(suffix) ? [k, ...suffix] : k + suffix);
      });

      // If the node is a sentinel, we push the suffix to the results
      if (node[SENTINEL]) {
        onMatches(suffix);
      }
    } while (nodeStack.length);
  };

  interface FindSingleChildLeafResult {
    node: TrieNode,
    toPrune: TrieNode | null,
    tokenToPrune: string | null,
    parent: TrieNode
  }

  const getSingleChildLeaf = (tokens: string | string[]): FindSingleChildLeafResult | null => {
    let toPrune: TrieNode | null = null;
    let tokenToPrune: string | null = null;

    const onLoop = (node: TrieNode, parent: TrieNode, token: string) => {
      // Keeping track of a potential branch to prune

      // Even if the node size is 1, but the single child is ".", we should retain the branch
      // Since the "." could be special if it is the leaf-est node
      const onlyChild = node.size < 2 && (!hostnameMode || !node.has('.'));

      if (toPrune != null) { // the top-est branch that could potentially being pruned
        if (!onlyChild) {
          // The branch has moew than single child, retain the branch.
          // And we need to abort prune the parent, so we set it to null
          toPrune = null;
          tokenToPrune = null;
        }
      } else if (onlyChild) {
        // There is only one token child, or no child at all, we can prune it safely
        // It is now the top-est branch that could potentially being pruned
        toPrune = parent;
        tokenToPrune = token;
      }
    };

    const res = walkIntoLeafWithTokens(tokens, onLoop);

    if (res === null) return null;
    return { node: res.node, toPrune, tokenToPrune, parent: res.parent };
  };

  /**
   * Method used to retrieve every item in the trie with the given prefix.
   */
  const find = (inputSuffix: string, /** @default true */ includeEqualWithSuffix = true): string[] => {
    if (smolTree) {
      throw new Error('A Trie with smolTree enabled cannot perform find!');
    }

    const inputTokens = suffixToTokens(inputSuffix);
    const res = walkIntoLeafWithTokens(inputTokens);
    if (res === null) return [];

    const matches: Array<string | string[]> = [];

    const onMatches = includeEqualWithSuffix
      ? (suffix: string | string[]) => matches.push(suffix)
      : (
        hostnameMode
          ? (suffix: string[]) => {
            if (suffix.some((t, i) => t !== inputTokens[i])) {
              matches.push(suffix);
            }
          }
          : (suffix: string) => {
            if (suffix !== inputTokens) {
              matches.push(suffix);
            }
          }
      );

    walk(
      onMatches as any,
      res.node, // Performing DFS from prefix
      inputTokens
    );

    return hostnameMode ? matches.map((m) => (m as string[]).join('')) : matches as string[];
  };

  /**
   * Works like trie.find, but instead of returning the matches as an array, it removes them from the given set in-place.
   */
  const substractSetInPlaceFromFound = (inputSuffix: string, set: Set<string>) => {
    if (smolTree) {
      throw new Error('A Trie with smolTree enabled cannot perform substractSetInPlaceFromFound!');
    }

    const inputTokens = suffixToTokens(inputSuffix);

    const res = walkIntoLeafWithTokens(inputTokens);
    if (res === null) return;

    const onMatches = hostnameMode
      ? (suffix: string[]) => set.delete(suffix.join(''))
      : (suffix: string) => set.delete(suffix);

    walk(
      onMatches as any,
      res.node, // Performing DFS from prefix
      inputTokens
    );
  };

  /**
   * Method used to delete a prefix from the trie.
   */
  const remove = (suffix: string): boolean => {
    const res = getSingleChildLeaf(suffixToTokens(suffix));
    if (res === null) return false;

    if (!res.node[SENTINEL]) return false;

    size--;
    const { node, toPrune, tokenToPrune } = res;

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
    const tokens = suffixToTokens(suffix);
    const res = walkIntoLeafWithTokens(tokens);

    return res
      ? res.node[SENTINEL]
      : false;
  };

  const dump = () => {
    const results: string[] = [];

    walk(suffix => {
      results.push(
        isHostnameMode(suffix) ? suffix.join('') : suffix
      );
    });

    return results;
  };

  const whitelist = (suffix: string) => {
    if (!hostnameMode && !smolTree) {
      throw new Error('whitelist method is only available in hostname mode or smolTree mode.');
    }

    const tokens = suffixToTokens(suffix);
    const res = getSingleChildLeaf(tokens);

    if (res === null) return;

    const { node, toPrune, tokenToPrune, parent } = res;

    // Trying to whitelist `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie
    if (tokens[0] === '.') {
      // If there is a `[start]sub.example.com` here, remove it
      parent[SENTINEL] = false;
      // Removing all the child nodes by disconnecting "."
      parent.delete('.');
    }

    // Trying to whitelist `example.com` when there is already a `.example.com` in the trie
    const dotNode = node.get('.');
    if (dotNode?.[SENTINEL] === true) {
      dotNode[SENTINEL] = false;
    }

    // return early if not found
    if (!node[SENTINEL]) return;

    if (tokenToPrune && toPrune) {
      toPrune.delete(tokenToPrune);
    } else {
      node[SENTINEL] = false;
    }
  };

  // Actually build trie
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

    [Bun.inspect.custom]: (depth: number) => JSON.stringify(deepTrieNodeToJSON(root), null, 2).split('\n').map((line) => ' '.repeat(depth) + line).join('\n'),

    hostnameMode,
    smolTree
  };
};

export type Trie = ReturnType<typeof createTrie>;

export default createTrie;
