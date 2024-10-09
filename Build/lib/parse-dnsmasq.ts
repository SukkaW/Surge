import { createReadlineInterfaceFromResponse } from './fetch-text-by-line';
import { parse as tldtsParse } from 'tldts';
import { fetchWithRetry, defaultRequestInit } from './fetch-retry';

const isDomainLoose = (domain: string): boolean => {
  const { isIcann, isPrivate, isIp } = tldtsParse(domain);
  return !!(!isIp && (isIcann || isPrivate));
};

export const extractDomainsFromFelixDnsmasq = (line: string): string | null => {
  if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
    return line.slice(8, -16);
  }
  return null;
};

export const parseFelixDnsmasqFromResp = async (resp: Response): Promise<string[]> => {
  const results: string[] = [];

  for await (const line of createReadlineInterfaceFromResponse(resp)) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain && isDomainLoose(domain)) {
      results.push(domain);
    }
  }

  return results;
};

export const parseFelixDnsmasq = async (url: string | URL): Promise<string[]> => {
  const resp = await fetchWithRetry(url, defaultRequestInit);
  return parseFelixDnsmasqFromResp(resp);
};
