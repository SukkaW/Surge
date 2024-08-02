/**
 * Suffix Trie based on Mnemonist Trie
 */

import { fastStringArrayJoin } from './misc';
import { inspect } from 'util';

const noop = () => { /** noop */ };

type TrieNode = [
  boolean, /** sentinel */
  TrieNode | null, /** parent */
  Map<string, TrieNode> /** children */
];

const deepTrieNodeToJSON = (node: TrieNode) => {
  const obj: Record<string, any> = {};
  if (node[0]) {
    obj['[start]'] = node[0];
  }
  node[2].forEach((value, key) => {
    obj[key] = deepTrieNodeToJSON(value);
  });
  return obj;
};

const createNode = (parent: TrieNode | null = null): TrieNode => {
  return [false, parent, new Map<string, TrieNode>()] as TrieNode;
};

const hostnameToTokens = (hostname: string): string[] => {
  return hostname.split('.').reduce<string[]>((acc, token, index) => {
    if (index > 0) {
      acc.push('.', token);
    } else if (token.length > 0) {
      acc.push(token);
    }
    return acc;
  }, []);
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
  const add = smolTree
    ? (suffix: string): void => {
      let node: TrieNode = root;
      let token: string;

      const tokens = suffixToTokens(suffix);

      for (let i = tokens.length - 1; i >= 0; i--) {
        token = tokens[i];

        if (node[2].has(token)) {
          node = node[2].get(token)!;

          // During the adding of `[start]blog|.skk.moe` and find out that there is a `[start].skk.moe` in the trie
          // Dedupe the covered subdomain by skipping
          if (token === '.' && node[0]) {
            return;
          }
        } else {
          const newNode = createNode(node);
          node[2].set(token, newNode);
          node = newNode;
        }
      }

      // If we are in smolTree mode, we need to do something at the end of the loop
      if (tokens[0] === '.') {
        // Trying to add `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie

        const parent = node[1]!;

        // Make sure parent `[start]sub.example.com` (without dot) is removed (SETINEL to false)
        parent[0] = false;

        // Removing the rest of the parent's child nodes
        node[2].clear();
        // The SENTINEL of this node will be set to true at the end of the function, so we don't need to set it here

        // we can use else-if here, because the children is now empty, we don't need to check the leading "."
      } else if (node[2].get('.')?.[0] === true) {
        // Trying to add `example.com` when there is already a `.example.com` in the trie
        // No need to increment size and set SENTINEL to true (skip this "new" item)
        return;
      }

      node[0] = true;
    }
    : (suffix: string): void => {
      let node: TrieNode = root;
      let token: string;

      const tokens = suffixToTokens(suffix);

      for (let i = tokens.length - 1; i >= 0; i--) {
        token = tokens[i];

        if (node[2].has(token)) {
          node = node[2].get(token)!;
        } else {
          const newNode = createNode(node);
          node[2].set(token, newNode);
          node = newNode;
        }
      }

      if (!node[0]) { // smol tree don't have size, so else-if here
        size++;
        node[0] = true;
      }
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

      if (node[2].has(token)) {
        node = node[2].get(token)!;
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

      node[2].forEach((childNode, k) => {
        // Pushing the child node to the stack for next iteration of DFS
        nodeStack.push(childNode);

        suffixStack.push(isHostnameMode(suffix) ? [k, ...suffix] : k + suffix);
      });

      // If the node is a sentinel, we push the suffix to the results
      if (node[0]) {
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
      const onlyChild = node[2].size < 2 && (!hostnameMode || !node[2].has('.'));

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

    if (!res.node[0]) return false;

    size--;
    const { node, toPrune, tokenToPrune } = res;

    if (tokenToPrune && toPrune) {
      toPrune[2].delete(tokenToPrune);
    } else {
      node[0] = false;
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
      ? res.node[0]
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
      parent[0] = false;
      // Removing all the child nodes by disconnecting "."
      parent[2].delete('.');
    }

    // Trying to whitelist `example.com` when there is already a `.example.com` in the trie
    const dotNode = node[2].get('.');
    if (dotNode) {
      dotNode[0] = false;
    }
    // if (dotNode?.s === true) {
    //   dotnode[0] = false;
    // }

    // return early if not found
    if (!node[0]) return;

    if (tokenToPrune && toPrune) {
      toPrune[2].delete(tokenToPrune);
    } else {
      node[0] = false;
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

    [inspect.custom]: (depth: number) => fastStringArrayJoin(
      JSON.stringify(deepTrieNodeToJSON(root), null, 2).split('\n').map((line) => ' '.repeat(depth) + line),
      '\n'
    ),
    hostnameMode,
    smolTree
  };
};

export type Trie = ReturnType<typeof createTrie>;

export default createTrie;
