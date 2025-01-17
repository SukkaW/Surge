import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { fastNormalizeDomain } from '../normalize-domain';
import { processLine } from '../process-line';
import { onBlackFound } from './shared';

function hostsLineCb(l: string, set: string[], includeAllSubDomain: boolean, meta: string) {
  const line = processLine(l);
  if (!line) {
    return;
  }

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
    const text = await span.traceChild('download').traceAsyncFn(() => fetchAssets(hostsUrl, mirrors));

    const domainSets: string[] = [];

    const filterRules = text.split('\n');

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        hostsLineCb(filterRules[i], domainSets, includeAllSubDomain, hostsUrl);
      }
    });

    return domainSets;
  });
}

export function processHostsWithPreload(hostsUrl: string, mirrors: string[] | null, includeAllSubDomain = false) {
  const downloadPromise = fetchAssets(hostsUrl, mirrors);

  return (span: Span) => span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const text = await span.traceChild('download').tracePromise(downloadPromise);

    const domainSets: string[] = [];

    const filterRules = text.split('\n');

    span.traceChild('parse hosts').traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        hostsLineCb(filterRules[i], domainSets, includeAllSubDomain, hostsUrl);
      }
    });

    return domainSets;
  });
}
