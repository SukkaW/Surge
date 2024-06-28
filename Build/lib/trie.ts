/**
 * Suffix Trie based on Mnemonist Trie
 */

import { fastStringArrayJoin } from './misc';

// const { Error, Bun, JSON, Symbol } = globalThis;

const noop = () => { /** noop */ };

interface TrieNode {
  s: boolean,
  p: TrieNode | null,
  [Bun.inspect.custom](): string,
  c: Map<string, TrieNode>
}

const deepTrieNodeToJSON = (node: TrieNode) => {
  const obj: Record<string, any> = {};
  if (node.s) {
    obj['[start]'] = node.s;
  }
  node.c.forEach((value, key) => {
    obj[key] = deepTrieNodeToJSON(value);
  });
  return obj;
};

function trieNodeInspectCustom(this: TrieNode) {
  return JSON.stringify(deepTrieNodeToJSON(this), null, 2);
}

const createNode = (parent: TrieNode | null = null): TrieNode => {
  return {
    s: false,
    p: parent,
    c: new Map<string, TrieNode>(),
    [Bun.inspect.custom]: trieNodeInspectCustom
  };
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

      if (node.c.has(token)) {
        node = node.c.get(token)!;

        // During the adding of `[start]blog|.skk.moe` and find out that there is a `[start].skk.moe` in the trie
        // Dedupe the covered subdomain by skipping
        if (smolTree && token === '.' && node.s) {
          return;
        }
      } else {
        const newNode = createNode(node);
        node.c.set(token, newNode);
        node = newNode;
      }
    }

    // If we are in smolTree mode, we need to do something at the end of the loop
    if (smolTree) {
      if (tokens[0] === '.') {
        // Trying to add `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie

        const parent = node.p!;

        // Make sure parent `[start]sub.example.com` (without dot) is removed (SETINEL to false)
        parent.s = false;

        // Removing the rest of the parent's child nodes
        node.c.clear();
        // The SENTINEL of this node will be set to true at the end of the function, so we don't need to set it here

        // we can use else-if here, because the children is now empty, we don't need to check the leading "."
      } else if (node.c.get('.')?.s === true) {
        // Trying to add `example.com` when there is already a `.example.com` in the trie
        // No need to increment size and set SENTINEL to true (skip this "new" item)
        return;
      }
    } else if (!node.s) { // smol tree don't have size, so else-if here
      size++;
    }

    node.s = true;
  };

  const walkIntoLeafWithTokens = (
    tokens: string | string[],
    onLoop: (node: TrieNode, parent: TrieNode, token: string) => void = noop
  ) => {
    let node: TrieNode = root;
    let parent: TrieNode = node;

    let token: string;

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      if (hostnameMode && token === '') {
        break;
      }

      parent = node;

      if (node.c.has(token)) {
        node = node.c.get(token)!;
      } else {
        return null;
      }

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

      node.c.forEach((childNode, k) => {
        // Pushing the child node to the stack for next iteration of DFS
        nodeStack.push(childNode);

        suffixStack.push(isHostnameMode(suffix) ? [k, ...suffix] : k + suffix);
      });

      // If the node is a sentinel, we push the suffix to the results
      if (node.s) {
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
      const onlyChild = node.c.size < 2 && (!hostnameMode || !node.c.has('.'));

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

    return hostnameMode ? matches.map((m) => fastStringArrayJoin(m as string[], '')) : matches as string[];
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
      ? (suffix: string[]) => set.delete(fastStringArrayJoin(suffix, ''))
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

    if (!res.node.s) return false;

    size--;
    const { node, toPrune, tokenToPrune } = res;

    if (tokenToPrune && toPrune) {
      toPrune.c.delete(tokenToPrune);
    } else {
      node.s = false;
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
      ? res.node.s
      : false;
  };

  const dump = () => {
    const results: string[] = [];

    walk(suffix => {
      results.push(
        isHostnameMode(suffix) ? fastStringArrayJoin(suffix, '') : suffix
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
      parent.s = false;
      // Removing all the child nodes by disconnecting "."
      parent.c.delete('.');
    }

    // Trying to whitelist `example.com` when there is already a `.example.com` in the trie
    const dotNode = node.c.get('.');
    if (dotNode) {
      dotNode.s = false;
    }
    // if (dotNode?.s === true) {
    //   dotNode.s = false;
    // }

    // return early if not found
    if (!node.s) return;

    if (tokenToPrune && toPrune) {
      toPrune.c.delete(tokenToPrune);
    } else {
      node.s = false;
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
