import { createTrie } from './trie';

export function domainDeduper(inputDomains: string[], toArray?: true): string[];
export function domainDeduper(inputDomains: string[], toArray: false): Set<string>;
export function domainDeduper(inputDomains: string[], toArray = true): string[] | Set<string> {
  const trie = createTrie(inputDomains);
  const sets = new Set(inputDomains);

  for (let i = 0, len1 = inputDomains.length; i < len1; i++) {
    const d = inputDomains[i];
    if (d[0] !== '.') {
      continue;
    }

    const found = trie.find(d, false);

    for (let j = 0, len2 = found.length; j < len2; j++) {
      sets.delete(found[j]);
    }

    sets.delete(d.slice(1));
  }

  if (toArray) {
    return Array.from(sets);
  }

  return sets;
}
