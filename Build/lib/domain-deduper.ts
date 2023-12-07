import { createTrie } from './trie';

export function domainDeduper(inputDomains: string[], toArray?: true): string[];
export function domainDeduper(inputDomains: string[], toArray: false): Set<string>;
export function domainDeduper(inputDomains: string[], toArray = true): string[] | Set<string> {
  const trie = createTrie(inputDomains);
  const sets = new Set(inputDomains);

  for (let j = 0, len = inputDomains.length; j < len; j++) {
    const d = inputDomains[j];
    if (d[0] !== '.') {
      continue;
    }

    trie.find(d, false).forEach(f => sets.delete(f));

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

export default domainDeduper;
