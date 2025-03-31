import { fastNormalizeDomainWithoutWww } from '../normalize-domain';
import { limit, onBlackFound } from './shared';
import { fetchAssets } from '../fetch-assets';
import type { Span } from '../../trace';

export function processDomainListsWithPreload(
  domainListsUrl: string, mirrors: string[] | null,
  includeAllSubDomain = false
) {
  const downloadPromise = limit.add(() => fetchAssets(domainListsUrl, mirrors, true));

  return (span: Span, onDomain: (domain: string, includeAllSubDomain: boolean) => void) => span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const filterRules = await span.traceChildPromise('download', downloadPromise);
    const domainSets: string[] = [];

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        const domain = fastNormalizeDomainWithoutWww(filterRules[i]);
        if (!domain) return;

        onBlackFound(domain, domainListsUrl);

        onDomain(domain, includeAllSubDomain);
      }
    });

    return domainSets;
  });
}
