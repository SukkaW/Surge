import { createTrie, type Trie } from './trie';

export function domainDeduper(inputDomains: string[] | Trie, toArray?: true): string[];
export function domainDeduper(inputDomains: string[] | Trie, toArray: false): Set<string>;
export function domainDeduper(inputDomains: string[] | Trie, toArray = true): string[] | Set<string> {
  let trie: Trie;
  if (Array.isArray(inputDomains)) {
    trie = createTrie(inputDomains, true, true);
  } else if (!inputDomains.hostnameMode || !inputDomains.smolTree) {
    throw new Error('Invalid trie');
  } else {
    trie = inputDomains;
  }

  const dumped = trie.dump();
  if (toArray) {
    return dumped;
  }
  return new Set(dumped);

  // const trie = createTrie(inputDomains, true);
  // const sets = new Set(inputDomains);

  // for (let i = 0, len1 = inputDomains.length; i < len1; i++) {
  //   const d = inputDomains[i];
  //   if (d[0] !== '.') {
  //     continue;
  //   }

  //   trie.substractSetInPlaceFromFound(d, sets);
  //   sets.delete(d.slice(1));
  // }

  // if (toArray) {
  //   return Array.from(sets);
  // }

  // return sets;
}
