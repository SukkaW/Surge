import { fastNormalizeDomain, fastNormalizeDomainIgnoreWww } from '../normalize-domain';
import { processLine } from '../process-line';
import { onBlackFound } from './shared';
import { fetchAssets } from '../fetch-assets';
import type { Span } from '../../trace';

function domainListLineCb(l: string, set: string[], meta: string, normalizeDomain = fastNormalizeDomain) {
  const line = processLine(l);
  if (!line) return;

  const domain = normalizeDomain(line);
  if (!domain) return;

  onBlackFound(domain, meta);

  set.push(domain);
}

function domainListLineCbIncludeAllSubdomain(l: string, set: string[], meta: string, normalizeDomain = fastNormalizeDomain) {
  const line = processLine(l);
  if (!line) return;

  const domain = normalizeDomain(line);
  if (!domain) return;

  onBlackFound(domain, meta);

  set.push('.' + domain);
}

export function processDomainLists(
  span: Span,
  domainListsUrl: string, mirrors: string[] | null, includeAllSubDomain = false, wwwToApex = false
) {
  const domainNormalizer = wwwToApex ? fastNormalizeDomainIgnoreWww : fastNormalizeDomain;
  const lineCb = includeAllSubDomain ? domainListLineCbIncludeAllSubdomain : domainListLineCb;

  return span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const text = await span.traceChildAsync('download', () => fetchAssets(
      domainListsUrl,
      mirrors
    ));
    const domainSets: string[] = [];
    const filterRules = text.split('\n');

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i], domainSets, domainListsUrl, domainNormalizer);
      }
    });

    return domainSets;
  });
}

export function processDomainListsWithPreload(
  domainListsUrl: string, mirrors: string[] | null,
  includeAllSubDomain = false, wwwToApex = false
) {
  const domainNormalizer = wwwToApex ? fastNormalizeDomainIgnoreWww : fastNormalizeDomain;

  const downloadPromise = fetchAssets(domainListsUrl, mirrors);
  const lineCb = includeAllSubDomain ? domainListLineCbIncludeAllSubdomain : domainListLineCb;

  return (span: Span) => span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const text = await span.traceChildPromise('download', downloadPromise);
    const domainSets: string[] = [];
    const filterRules = text.split('\n');

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        lineCb(filterRules[i], domainSets, domainListsUrl, domainNormalizer);
      }
    });

    return domainSets;
  });
}
