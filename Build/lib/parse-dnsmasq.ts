import { createReadlineInterfaceFromResponse } from './fetch-text-by-line';
import { parse as tldtsParse } from 'tldts';
import { $fetch } from './make-fetch-happen';
import type { NodeFetchResponse } from './make-fetch-happen';

function isDomainLoose(domain: string): boolean {
  const { isIcann, isPrivate, isIp } = tldtsParse(domain);
  return !!(!isIp && (isIcann || isPrivate));
}

export function extractDomainsFromFelixDnsmasq(line: string): string | null {
  if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
    return line.slice(8, -16);
  }
  return null;
}

export async function parseFelixDnsmasqFromResp(resp: Response | NodeFetchResponse): Promise<string[]> {
  const results: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp)) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain && isDomainLoose(domain)) {
      results.push(domain);
    }
  }

  return results;
}

export async function parseFelixDnsmasq(url: string): Promise<string[]> {
  const resp = await $fetch(url);
  return parseFelixDnsmasqFromResp(resp);
}
