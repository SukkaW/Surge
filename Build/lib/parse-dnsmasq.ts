import { fetchRemoteTextByLine } from './fetch-text-by-line';
import { parse } from 'tldts';

const isDomainLoose = (domain: string): boolean => {
  const { isIcann, isPrivate, isIp } = parse(domain);
  return !!(!isIp && (isIcann || isPrivate));
};

export const extractDomainsFromFelixDnsmasq = (line: string): string | null => {
  if (line.startsWith('server=/') && line.endsWith('/114.114.114.114')) {
    return line.slice(8, -16);
  }
  return null;
};

export const parseFelixDnsmasq = async (url: string | URL): Promise<string[]> => {
  const res: string[] = [];
  for await (const line of await fetchRemoteTextByLine(url)) {
    const domain = extractDomainsFromFelixDnsmasq(line);
    if (domain && isDomainLoose(domain)) {
      res.push(domain);
    }
  }

  return res;
};
