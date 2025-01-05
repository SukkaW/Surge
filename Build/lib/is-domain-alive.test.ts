import { describe, it } from 'mocha';

import { isDomainAlive, whoisExists } from './is-domain-alive';
import { expect } from 'expect';

describe('whoisExists', () => {
  it('.cryptocrawler.io', () => {
    expect(whoisExists({
      'whois.nic.io': {
        'Domain Status': [],
        'Name Server': [],
        '>>> Last update of WHOIS database': '2025-01-05T11:06:38Z <<<',
        text: [
          'Domain not found.',
          '',
          'Terms of Use: Access to WHOIS'
        ]
      }
    })).toBe(false);
  });

  it('.tunevideo.ru', () => {
    expect(whoisExists({
      'whois.tcinet.ru': {
        'Domain Status': [],
        'Name Server': [],
        text: [
          '% TCI Whois Service. Terms of use:',
          '% https://tcinet.ru/documents/whois_ru_rf.pdf (in Russian)',
          '% https://tcinet.ru/documents/whois_su.pdf (in Russian)',
          '',
          'No entries found for the selected source(s).',
          '',
          'Last updated on 2025-01-05T11:03:01Z'
        ]
      }
    })).toBe(false);
  });

  it('.myqloud.com', () => {
    expect(whoisExists({
      'whois.tcinet.ru': {
        'Domain Status': [],
        'Name Server': [],
        text: [
          '% TCI Whois Service. Terms of use:',
          '% https://tcinet.ru/documents/whois_ru_rf.pdf (in Russian)',
          '% https://tcinet.ru/documents/whois_su.pdf (in Russian)',
          '',
          'No entries found for the selected source(s).',
          '',
          'Last updated on 2025-01-05T11:03:01Z'
        ]
      }
    })).toBe(false);
  });
});

describe('isDomainAlive', function () {
  this.timeout(10000);

  it('.cryptocrawler.io', async () => {
    expect((await isDomainAlive('.cryptocrawler.io', true))[1]).toEqual(false);
  });

  it('.tunevideo.ru', async () => {
    expect((await isDomainAlive('.tunevideo.ru', true))[1]).toEqual(false);
  });

  it('.myqloud.com', async () => {
    expect((await isDomainAlive('.myqloud.com', true))[1]).toEqual(true);
  });

  it('discount-deal.org', async () => {
    expect((await isDomainAlive('discount-deal.org', false))[1]).toEqual(false);
  });
});
