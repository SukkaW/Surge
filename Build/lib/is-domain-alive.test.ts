import { describe, it } from 'mocha';

import { isDomainAlive } from './is-domain-alive';
import { expect } from 'expect';

describe('isDomainAlive', function () {
  this.timeout(10000);

  it('samsungcloudsolution.net', async () => {
    expect((await isDomainAlive('samsungcloudsolution.net', true))).toEqual(false);
  });

  it('ecdasoin.it', async () => {
    expect((await isDomainAlive('.ecdasoin.it', true))).toEqual(false);
  });
});
