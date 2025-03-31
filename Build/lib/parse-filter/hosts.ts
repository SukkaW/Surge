import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { fastNormalizeDomainWithoutWww } from '../normalize-domain';
import { limit, onBlackFound } from './shared';

const rSpace = /\s+/;

function hostsLineCb(line: string, set: string[], includeAllSubDomain: boolean, meta: string) {
  const _domain = line.split(rSpace, 3)[1]?.trim();
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomainWithoutWww(_domain);
  if (!domain) {
    return;
  }

  onBlackFound(domain, meta);

  set.push(includeAllSubDomain ? `.${domain}` : domain);
}

export function processHosts(
  span: Span,
  hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false
) {
  return span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const filterRules = await span.traceChild('download').traceAsyncFn(() => fetchAssets(hostsUrl, mirrors, true));

    const domainSets: string[] = [];

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        hostsLineCb(filterRules[i], domainSets, includeAllSubDomain, hostsUrl);
      }
    });

    return domainSets;
  });
}

export function processHostsWithPreload(hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false) {
  const downloadPromise = limit.add(() => fetchAssets(hostsUrl, mirrors, true));

  return (span: Span) => span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const filterRules = await span.traceChild('download').tracePromise(downloadPromise);

    const domainSets: string[] = [];

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        hostsLineCb(filterRules[i], domainSets, includeAllSubDomain, hostsUrl);
      }
    });

    return domainSets;
  });
}
