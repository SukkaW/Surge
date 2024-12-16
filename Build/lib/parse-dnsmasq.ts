import { createReadlineInterfaceFromResponse } from './fetch-text-by-line';

// https://github.com/remusao/tldts/issues/2121
// In short, single label domain suffix is ignored due to the size optimization, so no isIcann
// import tldts from 'tldts-experimental';
import tldts from 'tldts';
import type { NodeFetchResponse } from './make-fetch-happen';
import type { UndiciResponseData } from './fetch-retry';
import type { Response } from 'undici';

function isDomainLoose(domain: string): boolean {
  const r = tldts.parse(domain);
  return !!(!r.isIp && (r.isIcann || r.isPrivate));
}

export function extractDomainsFromFelixDnsmasq(line: string): string | null {
  if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
    return line.slice(8, -16);
  }
  return null;
}

export async function parseFelixDnsmasqFromResp(resp: NodeFetchResponse | UndiciResponseData | Response): Promise<string[]> {
  const results: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp, true)) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain && isDomainLoose(domain)) {
      results.push(domain);
    }
  }

  return results;
}
