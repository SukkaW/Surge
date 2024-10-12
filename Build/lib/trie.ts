/**
 * Hostbane-Optimized Trie based on Mnemonist Trie
 */

import { fastStringArrayJoin } from './misc';
import util from 'node:util';
import { noop } from 'foxact/noop';

type TrieNode<Meta = any> = [
  boolean, /** sentinel */
  TrieNode | null, /** parent */
  Map<string, TrieNode>, /** children */
  Meta /** meta */
];

function deepTrieNodeToJSON(node: TrieNode,
  unpackMeta: ((meta?: any) => string) | undefined) {
  const obj: Record<string, any> = {};
  if (node[0]) {
    obj['[start]'] = node[0];
  }
  if (node[3] != null) {
    if (unpackMeta) {
      obj['[meta]'] = unpackMeta(node[3]);
    } else {
      obj['[meta]'] = node[3];
    }
  }
  node[2].forEach((value, key) => {
    obj[key] = deepTrieNodeToJSON(value, unpackMeta);
  });
  return obj;
}

const createNode = <Meta = any>(parent: TrieNode | null = null): TrieNode => [false, parent, new Map<string, TrieNode>(), null] as TrieNode<Meta>;

export function hostnameToTokens(hostname: string): string[] {
  const tokens = hostname.split('.');
  const results: string[] = [];
  let token = '';
  for (let i = 0, l = tokens.length; i < l; i++) {
    if (i > 0) {
      results.push('.');
    }

    token = tokens[i];
    if (token.length > 0) {
      results.push(token);
    }
  }
  return results;
}

function walkHostnameTokens(hostname: string, onToken: (token: string) => boolean | null): boolean | null {
  const tokens = hostname.split('.');
  let token = '';

  const l = tokens.length - 1;
  for (let i = l; i >= 0; i--) {
    if (
      i < l // when i === l, we are at the first of hostname, no splitor there
      // when onToken returns true, we should skip the rest of the loop
      && onToken('.')
    ) {
      return true;
    }

    token = tokens[i];
    if (
      token.length > 0
      // when onToken returns true, we should skip the rest of the loop
      && onToken(token)
    ) {
      return true;
    }
  }

  return false;
}

interface FindSingleChildLeafResult<Meta> {
  node: TrieNode<Meta>,
  toPrune: TrieNode<Meta> | null,
  tokenToPrune: string | null,
  parent: TrieNode<Meta>
}

abstract class Triebase<Meta = any> {
  protected readonly $root: TrieNode<Meta> = createNode();
  protected $size = 0;

  get root() {
    return this.$root;
  }

  constructor(from?: string[] | Set<string> | null) {
    // Actually build trie
    if (Array.isArray(from)) {
      for (let i = 0, l = from.length; i < l; i++) {
        this.add(from[i]);
      }
    } else if (from) {
      from.forEach((value) => this.add(value));
    }
  }

  public abstract add(suffix: string, meta?: Meta): void;

  protected walkIntoLeafWithTokens(
    tokens: string[],
    onLoop: (node: TrieNode, parent: TrieNode, token: string) => void = noop
  ) {
    let node: TrieNode = this.$root;
    let parent: TrieNode = node;

    let token: string;

    for (let i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      // if (token === '') {
      //   break;
      // }

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

  protected walkIntoLeafWithSuffix(
    suffix: string,
    onLoop: (node: TrieNode, parent: TrieNode, token: string) => void = noop
  ) {
    let node: TrieNode = this.$root;
    let parent: TrieNode = node;

    const onToken = (token: string) => {
      if (token === '') {
        return true;
      }

      parent = node;

      if (node[2].has(token)) {
        node = node[2].get(token)!;
      } else {
        return null;
      }

      onLoop(node, parent, token);

      return false;
    };

    if (walkHostnameTokens(suffix, onToken) === null) {
      return null;
    }

    return { node, parent };
  };

  public contains(suffix: string): boolean { return this.walkIntoLeafWithSuffix(suffix) !== null; };

  private walk(
    onMatches: (suffix: string[], meta: Meta) => void,
    initialNode = this.$root,
    initialSuffix: string[] = []
  ) {
    const nodeStack: Array<TrieNode<Meta>> = [initialNode];
    // Resolving initial string (begin the start of the stack)
    const suffixStack: string[][] = [initialSuffix];

    let node: TrieNode<Meta> = initialNode;

    do {
      node = nodeStack.pop()!;
      const suffix = suffixStack.pop()!;

      node[2].forEach((childNode, k) => {
        // Pushing the child node to the stack for next iteration of DFS
        nodeStack.push(childNode);

        suffixStack.push([k, ...suffix]);
      });

      // If the node is a sentinel, we push the suffix to the results
      if (node[0]) {
        onMatches(suffix, node[3]);
      }
    } while (nodeStack.length);
  };

  protected getSingleChildLeaf(tokens: string[]): FindSingleChildLeafResult<Meta> | null {
    let toPrune: TrieNode | null = null;
    let tokenToPrune: string | null = null;

    const onLoop = (node: TrieNode, parent: TrieNode, token: string) => {
      // Keeping track of a potential branch to prune

      // Even if the node size is 1, but the single child is ".", we should retain the branch
      // Since the "." could be special if it is the leaf-est node
      const onlyChild = node[2].size < 2 && !node[2].has('.');

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

    const res = this.walkIntoLeafWithTokens(tokens, onLoop);

    if (res === null) return null;
    return { node: res.node, toPrune, tokenToPrune, parent: res.parent };
  };

  /**
   * Method used to retrieve every item in the trie with the given prefix.
   */
  public find(
    inputSuffix: string,
    /** @default true */ includeEqualWithSuffix = true
  ): string[] {
    // if (smolTree) {
    //   throw new Error('A Trie with smolTree enabled cannot perform find!');
    // }

    const inputTokens = hostnameToTokens(inputSuffix);
    const res = this.walkIntoLeafWithTokens(inputTokens);
    if (res === null) return [];

    const matches: string[][] = [];

    const onMatches = includeEqualWithSuffix
      // fast path (default option)
      ? (suffix: string[]) => matches.push(suffix)
      // slow path
      : (suffix: string[]) => {
        if (!deepEqualArray(suffix, inputTokens)) {
          matches.push(suffix);
        }
      };

    this.walk(
      onMatches,
      res.node, // Performing DFS from prefix
      inputTokens
    );

    return matches.map((m) => fastStringArrayJoin(m, ''));
  };

  /**
   * Method used to delete a prefix from the trie.
   */
  public remove(suffix: string): boolean {
    const res = this.getSingleChildLeaf(hostnameToTokens(suffix));
    if (res === null) return false;

    if (!res.node[0]) return false;

    this.$size--;
    const { node, toPrune, tokenToPrune } = res;

    if (tokenToPrune && toPrune) {
      toPrune[2].delete(tokenToPrune);
    } else {
      node[0] = false;
    }

    return true;
  };

  // eslint-disable-next-line @typescript-eslint/unbound-method -- alias class methods
  public delete = this.remove;

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   */
  public has(suffix: string): boolean {
    const res = this.walkIntoLeafWithSuffix(suffix);

    return res
      ? res.node[0]
      : false;
  };

  public dump(onSuffix: (suffix: string) => void): void;
  public dump(): string[];
  public dump(onSuffix?: (suffix: string) => void): string[] | void {
    const results: string[] = [];

    const handleSuffix = onSuffix
      ? (suffix: string[]) => onSuffix(fastStringArrayJoin(suffix, ''))
      : (suffix: string[]) => results.push(fastStringArrayJoin(suffix, ''));

    this.walk(handleSuffix);

    return results;
  };

  public dumpMeta(onMeta: (meta: Meta) => void): void;
  public dumpMeta(): Meta[];
  public dumpMeta(onMeta?: (meta: Meta) => void): Meta[] | void {
    const results: Meta[] = [];

    const handleMeta = onMeta
      ? (_suffix: string[], meta: Meta) => onMeta(meta)
      : (_suffix: string[], meta: Meta) => results.push(meta);

    this.walk(handleMeta);

    return results;
  };

  public dumpWithMeta(onSuffix: (suffix: string, meta: Meta | undefined) => void): void;
  public dumpWithMeta(): string[];
  public dumpWithMeta(onSuffix?: (suffix: string, meta: Meta | undefined) => void): string[] | void {
    const results: string[] = [];

    const handleSuffix = onSuffix
      ? (suffix: string[], meta: Meta | undefined) => onSuffix(fastStringArrayJoin(suffix, ''), meta)
      : (suffix: string[]) => results.push(fastStringArrayJoin(suffix, ''));

    this.walk(handleSuffix);

    return results;
  };

  public inspect(depth: number, unpackMeta?: (meta?: Meta) => any) {
    return fastStringArrayJoin(
      JSON.stringify(deepTrieNodeToJSON(this.$root, unpackMeta), null, 2).split('\n').map((line) => ' '.repeat(depth) + line),
      '\n'
    );
  }

  public [util.inspect.custom](depth: number) {
    return this.inspect(depth);
  };
}

export class HostnameSmolTrie<Meta = any> extends Triebase<Meta> {
  public smolTree = true;

  add(suffix: string, meta?: Meta): void {
    let node: TrieNode<Meta> = this.$root;
    let curNodeChildren: Map<string, TrieNode<Meta>> = node[2];

    const onToken = (token: string) => {
      curNodeChildren = node[2];
      if (curNodeChildren.has(token)) {
        node = curNodeChildren.get(token)!;

        // During the adding of `[start]blog|.skk.moe` and find out that there is a `[start].skk.moe` in the trie, skip adding the rest of the node
        if (node[0] && token === '.') {
          return true;
        }
      } else {
        const newNode = createNode(node);
        curNodeChildren.set(token, newNode);
        node = newNode;
      }

      return false;
    };

    // When walkHostnameTokens returns true, we should skip the rest
    if (walkHostnameTokens(suffix, onToken)) {
      return;
    }

    // If we are in smolTree mode, we need to do something at the end of the loop
    if (suffix[0] === '.') {
      // Trying to add `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie

      // Make sure parent `[start]sub.example.com` (without dot) is removed (SETINEL to false)
      (/** parent */ node[1]!)[0] = false;

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
    node[3] = meta!;
  }

  public whitelist(suffix: string) {
    const tokens = hostnameToTokens(suffix);
    const res = this.getSingleChildLeaf(tokens);

    if (res === null) return;

    const { node, toPrune, tokenToPrune, parent } = res;

    // Trying to whitelist `[start].sub.example.com` where there is already a `[start]blog.sub.example.com` in the trie
    if (tokens[0] === '.') {
      // If there is a `[start]sub.example.com` here, remove it
      parent[0] = false;
      // Removing all the child nodes by empty the children
      // This removes the only child ".", which removes "blog.sub.example.com"
      parent[2].clear();
    } else {
    // Trying to whitelist `example.com` when there is already a `.example.com` in the trie
      const dotNode = node[2].get('.');
      if (dotNode) {
        dotNode[0] = false;
      }
    }

    // return early if not found
    if (!node[0]) return;

    if (tokenToPrune && toPrune) {
      toPrune[2].delete(tokenToPrune);
    } else {
      node[0] = false;
    }
  };
}

export class HostnameTrie<Meta = any> extends Triebase<Meta> {
  get size() {
    return this.$size;
  }

  add(suffix: string, meta?: Meta): void {
    let node: TrieNode<Meta> = this.$root;

    const onToken = (token: string) => {
      if (node[2].has(token)) {
        node = node[2].get(token)!;
      } else {
        const newNode = createNode(node);
        node[2].set(token, newNode);
        node = newNode;
      }

      return false;
    };

    // When walkHostnameTokens returns true, we should skip the rest
    if (walkHostnameTokens(suffix, onToken)) {
      return;
    }

    if (!node[0]) {
      this.$size++;
      node[0] = true;
      node[3] = meta!;
    }
  }
}

export function createTrie<Meta = any>(from: string[] | Set<string> | null, smolTree: true): HostnameSmolTrie<Meta>;
export function createTrie<Meta = any>(from?: string[] | Set<string> | null, smolTree?: false): HostnameTrie<Meta>;
export function createTrie<_Meta = any>(from?: string[] | Set<string> | null, smolTree = true) {
  if (smolTree) {
    return new HostnameSmolTrie(from);
  }
  return new HostnameTrie(from);
};

export type Trie = ReturnType<typeof createTrie>;

function deepEqualArray(a: string[], b: string[]) {
  let len = a.length;
  if (len !== b.length) return false;
  while (len--) {
    if (a[len] !== b[len]) return false;
  }
  return true;
};
