import { createTrie } from './trie';
import type { Trie } from './trie';

export function domainsetDeduper(inputDomains: string[] | Trie): string[] {
  let trie: Trie;
  if (Array.isArray(inputDomains)) {
    trie = createTrie(inputDomains, true);
  } else if (inputDomains.smolTree) {
    trie = inputDomains;
  } else {
    throw new Error('Invalid trie');
  }

  return trie.dump();
}
