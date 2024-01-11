import { createTrie } from './trie';

export function domainDeduper(inputDomains: string[], toArray?: true): string[];
export function domainDeduper(inputDomains: string[], toArray: false): Set<string>;
export function domainDeduper(inputDomains: string[], toArray = true): string[] | Set<string> {
  const trie = createTrie(inputDomains);
  const sets = new Set(inputDomains);

  for (let i = 0, len = inputDomains.length; i < len; i++) {
    const d = inputDomains[i];
    if (d[0] !== '.') {
      continue;
    }

    const found = trie.find(d, true);
    for (let j = 0, len = found.length; j < len; j++) {
      sets.delete(found[j]);
    }

    const a: string = d.slice(1);

    if (sets.has(a)) {
      sets.delete(a);
    }
  }

  if (toArray) {
    return Array.from(sets);
  }

  return sets;
}
