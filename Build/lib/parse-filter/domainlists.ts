import { fastNormalizeDomain, fastNormalizeDomainWithoutWww } from '../normalize-domain';
import { onBlackFound } from './shared';
import { fetchAssets } from '../fetch-assets';
import type { Span } from '../../trace';

function domainListLineCb(line: string, set: string[], meta: string, normalizeDomain = fastNormalizeDomain) {
  const domain = normalizeDomain(line);
  if (!domain) return;

  onBlackFound(domain, meta);

  set.push(domain);
}

function domainListLineCbIncludeAllSubdomain(line: string, set: string[], meta: string, normalizeDomain = fastNormalizeDomain) {
  const domain = normalizeDomain(line);
  if (!domain) return;

  onBlackFound(domain, meta);

  set.push('.' + domain);
}
export function processDomainListsWithPreload(
  domainListsUrl: string, mirrors: string[] | null,
  includeAllSubDomain = false
) {
  const downloadPromise = fetchAssets(domainListsUrl, mirrors, true);
  const lineCb = includeAllSubDomain ? domainListLineCbIncludeAllSubdomain : domainListLineCb;

  return (span: Span) => span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const filterRules = await span.traceChildPromise('download', downloadPromise);
    const domainSets: string[] = [];

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i], domainSets, domainListsUrl, fastNormalizeDomainWithoutWww);
      }
    });

    return domainSets;
  });
}
