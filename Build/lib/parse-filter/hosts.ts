import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { fastNormalizeDomainWithoutWww } from '../normalize-domain';
import { onBlackFound } from './shared';

const rSpace = /\s+/;

function hostsLineCb(line: string, set: string[], meta: string) {
  const _domain = line.split(rSpace, 3)[1];
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomainWithoutWww(_domain.trim());
  if (!domain) {
    return;
  }

  onBlackFound(domain, meta);

  set.push(domain);
}

function hostsLineCbIncludeAllSubdomain(line: string, set: string[], meta: string) {
  const _domain = line.split(rSpace, 3)[1];
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomainWithoutWww(_domain.trim());
  if (!domain) {
    return;
  }

  onBlackFound(domain, meta);

  set.push('.' + domain);
}

export function processHosts(
  span: Span,
  hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false
) {
  const cb = includeAllSubDomain ? hostsLineCbIncludeAllSubdomain : hostsLineCb;

  return span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const filterRules = await span.traceChild('download').traceAsyncFn(() => fetchAssets(hostsUrl, mirrors, true));

    const domainSets: string[] = [];

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        cb(filterRules[i], domainSets, hostsUrl);
      }
    });

    return domainSets;
  });
}

export function processHostsWithPreload(hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false, allowEmptyRemote = false) {
  const downloadPromise = fetchAssets(hostsUrl, mirrors, true, allowEmptyRemote);
  const cb = includeAllSubDomain ? hostsLineCbIncludeAllSubdomain : hostsLineCb;

  return (span: Span) => span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const filterRules = await span.traceChild('download').tracePromise(downloadPromise);

    const domainSets: string[] = [];

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        cb(filterRules[i], domainSets, hostsUrl);
      }
    });

    return domainSets;
  });
}
