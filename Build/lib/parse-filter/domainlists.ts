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
  includeAllSubDomain = false,
  allowEmptyRemote = false
) {
  const downloadPromise = fetchAssets(domainListsUrl, mirrors, true, allowEmptyRemote);
  const lineCb = includeAllSubDomain ? domainListLineCbIncludeAllSubdomain : domainListLineCb;

  return (span: Span) => span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (childSpan) => {
    const filterRules = await childSpan.traceChildPromise('download', downloadPromise);
    const domainSets: string[] = [];

    childSpan.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i], domainSets, domainListsUrl, fastNormalizeDomainWithoutWww);
      }
    });

    return domainSets;
  });
}
