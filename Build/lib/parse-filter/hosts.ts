import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { fastNormalizeDomain } from '../normalize-domain';
import { onBlackFound } from './shared';

function hostsLineCb(line: string, set: string[], includeAllSubDomain: boolean, meta: string) {
  const _domain = line.split(/\s/)[1]?.trim();
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomain(_domain);
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
  const downloadPromise = fetchAssets(hostsUrl, mirrors, true);

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
