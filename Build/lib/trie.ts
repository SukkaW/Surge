/**
 * Hostbane-Optimized Trie based on Mnemonist Trie
 */

import { fastStringCompare } from './misc';
import util from 'node:util';
import { noop } from 'foxts/noop';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import FIFO from 'fast-fifo';

type TrieNode<Meta = any> = [
  boolean, /** end */
  boolean, /** includeAllSubdomain (.example.org, ||example.com) */
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
  obj['[subdomain]'] = node[1];
  if (node[4] != null) {
    if (unpackMeta) {
      obj['[meta]'] = unpackMeta(node[3]);
    } else {
      obj['[meta]'] = node[3];
    }
  }
  node[3].forEach((value, key) => {
    obj[key] = deepTrieNodeToJSON(value, unpackMeta);
  });
  return obj;
}

const createNode = <Meta = any>(allSubdomain = false, parent: TrieNode | null = null): TrieNode => [false, allSubdomain, parent, new Map<string, TrieNode>(), null] as TrieNode<Meta>;

export function hostnameToTokens(hostname: string, hostnameFromIndex: number): string[] {
  const tokens = hostname.split('.');
  const results: string[] = [];
  let token = '';

  for (let i = hostnameFromIndex, l = tokens.length; i < l; i++) {
    token = tokens[i];
    if (token.length > 0) {
      results.push(token);
    }
  }

  return results;
}

function walkHostnameTokens(hostname: string, onToken: (token: string) => boolean | null, hostnameFromIndex: number): boolean | null {
  const tokens = hostname.split('.');

  const l = tokens.length - 1;

  // we are at the first of hostname, no splitor there
  let token = '';

  for (let i = l; i >= hostnameFromIndex; i--) {
    token = tokens[i];
    if (token.length > 0) {
      const t = onToken(token);
      if (t === null) {
        return null;
      }
      // if the callback returns true, we should skip the rest
      if (t) {
        return true;
      }
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

  public abstract add(suffix: string, includeAllSubdomain?: boolean, meta?: Meta, hostnameFromIndex?: number): void;

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

      if (node[3].has(token)) {
        node = node[3].get(token)!;
      } else {
        return null;
      }

      onLoop(node, parent, token);
    }

    return { node, parent };
  };

  protected walkIntoLeafWithSuffix(
    suffix: string,
    hostnameFromIndex: number,
    onLoop: (node: TrieNode, parent: TrieNode, token: string) => void = noop
  ) {
    let node: TrieNode = this.$root;
    let parent: TrieNode = node;

    const onToken = (token: string) => {
      // if (token === '') {
      //   return true;
      // }

      parent = node;

      if (node[3].has(token)) {
        node = node[3].get(token)!;
      } else {
        return null;
      }

      onLoop(node, parent, token);

      return false;
    };

    if (walkHostnameTokens(suffix, onToken, hostnameFromIndex) === null) {
      return null;
    }

    return { node, parent };
  };

  public contains(suffix: string, includeAllSubdomain = suffix[0] === '.'): boolean {
    const hostnameFromIndex = suffix[0] === '.' ? 1 : 0;

    const res = this.walkIntoLeafWithSuffix(suffix, hostnameFromIndex);
    if (!res) return false;
    if (includeAllSubdomain) return res.node[1];
    return true;
  };

  private static bfsResults: [node: TrieNode | null, suffix: string[]] = [null, []];

  private static bfs<Meta>(this: void, nodeStack: FIFO<TrieNode<Meta>>, suffixStack: FIFO<string[]>) {
    const node = nodeStack.shift()!;
    const suffix = suffixStack.shift()!;

    node[3].forEach((childNode, k) => {
      // Pushing the child node to the stack for next iteration of DFS
      nodeStack.push(childNode);

      suffixStack.push([k, ...suffix]);
    });

    Triebase.bfsResults[0] = node;
    Triebase.bfsResults[1] = suffix;

    return Triebase.bfsResults;
  }

  private static bfsWithSort<Meta>(this: void, nodeStack: FIFO<TrieNode<Meta>>, suffixStack: FIFO<string[]>) {
    const node = nodeStack.shift()!;
    const suffix = suffixStack.shift()!;

    if (node[3].size) {
      const keys = Array.from(node[3].keys()).sort(Triebase.compare);

      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        const childNode = node[3].get(key)!;

        // Pushing the child node to the stack for next iteration of DFS
        nodeStack.push(childNode);
        suffixStack.push([key, ...suffix]);
      }
    }

    Triebase.bfsResults[0] = node;
    Triebase.bfsResults[1] = suffix;

    return Triebase.bfsResults;
  }

  private walk(
    onMatches: (suffix: string[], subdomain: boolean, meta: Meta) => void,
    initialNode = this.$root,
    initialSuffix: string[] = [],
    withSort = false
  ) {
    const bfsImpl = withSort ? Triebase.bfsWithSort : Triebase.bfs;

    const nodeStack = new FIFO<TrieNode<Meta>>();
    nodeStack.push(initialNode);

    // Resolving initial string (begin the start of the stack)
    const suffixStack = new FIFO<string[]>();
    suffixStack.push(initialSuffix);

    let node: TrieNode<Meta> = initialNode;
    let r;

    do {
      r = bfsImpl(nodeStack, suffixStack);
      node = r[0]!;
      const suffix = r[1];

      // If the node is a sentinel, we push the suffix to the results
      if (node[0]) {
        onMatches(suffix, node[1], node[4]);
      }
    } while (nodeStack.length);
  };

  static compare(this: void, a: string, b: string) {
    if (a === b) return 0;
    return (a.length - b.length) || fastStringCompare(a, b);
  }

  private walkWithSort(
    onMatches: (suffix: string[], subdomain: boolean, meta: Meta) => void,
    initialNode = this.$root,
    initialSuffix: string[] = []
  ) {
    const nodeStack = new FIFO<TrieNode<Meta>>();
    nodeStack.push(initialNode);

    // Resolving initial string (begin the start of the stack)
    const suffixStack = new FIFO<string[]>();
    suffixStack.push(initialSuffix);

    let node: TrieNode<Meta> = initialNode;

    do {
      node = nodeStack.shift()!;
      const suffix = suffixStack.shift()!;

      if (node[3].size) {
        const keys = Array.from(node[3].keys()).sort(Triebase.compare);

        for (let i = 0, l = keys.length; i < l; i++) {
          const key = keys[i];
          const childNode = node[3].get(key)!;

          // Pushing the child node to the stack for next iteration of DFS
          nodeStack.push(childNode);
          suffixStack.push([key, ...suffix]);
        }
      }

      // If the node is a sentinel, we push the suffix to the results
      if (node[0]) {
        onMatches(suffix, node[1], node[4]);
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
      const onlyChild = node[3].size === 0 && !node[2];

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
    subdomainOnly = inputSuffix[0] === '.',
    hostnameFromIndex = inputSuffix[0] === '.' ? 1 : 0
    // /** @default true */ includeEqualWithSuffix = true
  ): string[] {
    const inputTokens = hostnameToTokens(inputSuffix, hostnameFromIndex);
    const res = this.walkIntoLeafWithTokens(inputTokens);
    if (res === null) return [];

    const results: string[] = [];

    const onMatches = subdomainOnly
      ? (suffix: string[], subdomain: boolean) => { // fast path (default option)
        const d = fastStringArrayJoin(suffix, '.');
        if (!subdomain && subStringEqual(inputSuffix, d, 1)) return;

        results.push(subdomain ? '.' + d : d);
      }
      : (suffix: string[], subdomain: boolean) => { // fast path (default option)
        const d = fastStringArrayJoin(suffix, '.');
        results.push(subdomain ? '.' + d : d);
      };

    this.walk(
      onMatches,
      res.node, // Performing DFS from prefix
      inputTokens
    );

    return results;
  };

  /**
   * Method used to delete a prefix from the trie.
   */
  public remove(suffix: string): boolean {
    const res = this.getSingleChildLeaf(hostnameToTokens(suffix, 0));
    if (res === null) return false;

    if (!res.node[0]) return false;

    this.$size--;
    const { node, toPrune, tokenToPrune } = res;

    if (tokenToPrune && toPrune) {
      toPrune[3].delete(tokenToPrune);
    } else {
      node[0] = false;
    }

    return true;
  };

  // eslint-disable-next-line @typescript-eslint/unbound-method -- safe
  public delete = this.remove;

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   */
  public has(suffix: string, includeAllSubdomain = suffix[0] === '.'): boolean {
    const hostnameFromIndex = suffix[0] === '.' ? 1 : 0;

    const res = this.walkIntoLeafWithSuffix(suffix, hostnameFromIndex);

    if (res === null) return false;
    if (!res.node[0]) return false;
    if (includeAllSubdomain) return res.node[1];
    return true;
  };

  public dumpWithoutDot(onSuffix: (suffix: string, subdomain: boolean) => void, withSort = false) {
    const handleSuffix = (suffix: string[], subdomain: boolean) => {
      onSuffix(fastStringArrayJoin(suffix, '.'), subdomain);
    };

    if (withSort) {
      this.walkWithSort(handleSuffix);
    } else {
      this.walk(handleSuffix);
    }
  }

  public dump(onSuffix: (suffix: string) => void, withSort?: boolean): void;
  public dump(onSuffix?: null, withSort?: boolean): string[];
  public dump(onSuffix?: ((suffix: string) => void) | null, withSort = false): string[] | void {
    const results: string[] = [];

    const handleSuffix = onSuffix
      ? (suffix: string[], subdomain: boolean) => {
        const d = fastStringArrayJoin(suffix, '.');
        onSuffix(subdomain ? '.' + d : d);
      }
      : (suffix: string[], subdomain: boolean) => {
        const d = fastStringArrayJoin(suffix, '.');
        results.push(subdomain ? '.' + d : d);
      };

    if (withSort) {
      this.walkWithSort(handleSuffix);
    } else {
      this.walk(handleSuffix);
    }

    return results;
  };

  public dumpMeta(onMeta: (meta: Meta) => void, withSort?: boolean): void;
  public dumpMeta(onMeta?: null, withSort?: boolean): Meta[];
  public dumpMeta(onMeta?: ((meta: Meta) => void) | null, withSort = false): Meta[] | void {
    const results: Meta[] = [];

    const handleMeta = onMeta
      ? (_suffix: string[], _subdomain: boolean, meta: Meta) => onMeta(meta)
      : (_suffix: string[], _subdomain: boolean, meta: Meta) => results.push(meta);

    if (withSort) {
      this.walkWithSort(handleMeta);
    } else {
      this.walk(handleMeta);
    }

    return results;
  };

  public dumpWithMeta(onSuffix: (suffix: string, meta: Meta | undefined) => void, withSort?: boolean): void;
  public dumpWithMeta(onMeta?: null, withSort?: boolean): Array<[string, Meta | undefined]>;
  public dumpWithMeta(onSuffix?: ((suffix: string, meta: Meta | undefined) => void) | null, withSort = false): Array<[string, Meta | undefined]> | void {
    const results: Array<[string, Meta | undefined]> = [];

    const handleSuffix = onSuffix
      ? (suffix: string[], subdomain: boolean, meta: Meta | undefined) => {
        const d = fastStringArrayJoin(suffix, '.');
        return onSuffix(subdomain ? '.' + d : d, meta);
      }
      : (suffix: string[], subdomain: boolean, meta: Meta | undefined) => {
        const d = fastStringArrayJoin(suffix, '.');
        results.push([subdomain ? '.' + d : d, meta]);
      };

    if (withSort) {
      this.walkWithSort(handleSuffix);
    } else {
      this.walk(handleSuffix);
    }

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

  add(suffix: string, includeAllSubdomain = suffix[0] === '.', meta?: Meta, hostnameFromIndex = suffix[0] === '.' ? 1 : 0): void {
    let node: TrieNode<Meta> = this.$root;
    let curNodeChildren: Map<string, TrieNode<Meta>> = node[3];

    const onToken = (token: string) => {
      curNodeChildren = node[3];
      if (curNodeChildren.has(token)) {
        node = curNodeChildren.get(token)!;

        // During the adding of `[start]blog|.skk.moe` and find out that there is a `[start].skk.moe` in the trie, skip adding the rest of the node
        if (node[1]) {
          return true;
        }
      } else {
        const newNode = createNode(false, node);
        curNodeChildren.set(token, newNode);
        node = newNode;
      }

      return false;
    };

    // When walkHostnameTokens returns true, we should skip the rest
    if (walkHostnameTokens(suffix, onToken, hostnameFromIndex)) {
      return;
    }

    // If we are in smolTree mode, we need to do something at the end of the loop
    if (includeAllSubdomain) {
      // Trying to add `[.]sub.example.com` where there is already a `blog.sub.example.com` in the trie

      // Make sure parent `[start]sub.example.com` (without dot) is removed (SETINEL to false)
      // (/** parent */ node[2]!)[0] = false;

      // Removing the rest of the parent's child nodes
      node[3].clear();
      // The SENTINEL of this node will be set to true at the end of the function, so we don't need to set it here

      // we can use else-if here, because the children is now empty, we don't need to check the leading "."
    } else if (node[1]) {
      // Trying to add `example.com` when there is already a `.example.com` in the trie
      // No need to increment size and set SENTINEL to true (skip this "new" item)
      return;
    }

    node[0] = true;
    node[1] = includeAllSubdomain;
    node[4] = meta!;
  }

  public whitelist(suffix: string, includeAllSubdomain = suffix[0] === '.', hostnameFromIndex = suffix[0] === '.' ? 1 : 0) {
    const tokens = hostnameToTokens(suffix, hostnameFromIndex);
    const res = this.getSingleChildLeaf(tokens);

    if (res === null) return;

    const { node, toPrune, tokenToPrune } = res;

    // Trying to whitelist `[start].sub.example.com` where there might already be a `[start]blog.sub.example.com` in the trie
    if (includeAllSubdomain) {
      // If there is a `[start]sub.example.com` here, remove it
      node[0] = false;
      node[1] = false;
      // Removing all the child nodes by empty the children
      node[3].clear();
    } else {
      // Trying to whitelist `example.com` when there is already a `.example.com` in the trie
      node[1] = false;
    }

    // return early if not found
    if (!node[0]) return;

    if (tokenToPrune && toPrune) {
      toPrune[3].delete(tokenToPrune);
    } else {
      node[0] = false;
    }
  };
}

export class HostnameTrie<Meta = any> extends Triebase<Meta> {
  get size() {
    return this.$size;
  }

  add(suffix: string, includeAllSubdomain = suffix[0] === '.', meta?: Meta, hostnameFromIndex = suffix[0] === '.' ? 1 : 0): void {
    let node: TrieNode<Meta> = this.$root;

    const onToken = (token: string) => {
      if (node[3].has(token)) {
        node = node[3].get(token)!;
      } else {
        const newNode = createNode(false, node);
        node[3].set(token, newNode);
        node = newNode;
      }

      return false;
    };

    // When walkHostnameTokens returns true, we should skip the rest
    if (walkHostnameTokens(suffix, onToken, hostnameFromIndex)) {
      return;
    }

    // if same entry has been added before, skip
    if (node[0]) {
      return;
    }

    this.$size++;
    node[0] = true;
    node[1] = includeAllSubdomain;
    node[4] = meta!;
  }
}

// function deepEqualArray(a: string[], b: string[]) {
//   let len = a.length;
//   if (len !== b.length) return false;
//   while (len--) {
//     if (a[len] !== b[len]) return false;
//   }
//   return true;
// };

function subStringEqual(needle: string, haystack: string, needleIndex = 0) {
  for (let i = 0, l = haystack.length; i < l; i++) {
    if (needle[i + needleIndex] !== haystack[i]) return false;
  }
  return true;
}
