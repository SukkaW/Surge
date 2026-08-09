import { describe, it } from 'mocha';
import { expect } from 'earl';
import { DOMAIN_ALIVE_REASON_MESSAGES, DOMAIN_ALIVE_REASONS } from 'domain-alive';
import { createDomainAliveMethods } from './is-domain-alive';

describe('domain-alive integration', () => {
  it('constructs the checkers with the custom DoH agent', async () => {
    const { isDomainAlive, isRegisterableDomainAlive } = createDomainAliveMethods({});
    const [domainResult, registerableDomainResult] = await Promise.all([
      isDomainAlive(''),
      isRegisterableDomainAlive('')
    ]);

    expect(domainResult.reason).toEqual(DOMAIN_ALIVE_REASONS.INVALID_DOMAIN);
    expect(registerableDomainResult.reason).toEqual(DOMAIN_ALIVE_REASONS.INVALID_DOMAIN);
    expect(DOMAIN_ALIVE_REASON_MESSAGES[domainResult.reason]).toEqual(
      'No registerable domain could be extracted.'
    );
  });
});
