import { describe, it } from 'mocha';

import { isDomainAlive } from './is-domain-alive';
import { expect } from 'expect';

import process from 'node:process';

describe('isDomainAlive', function () {
  this.timeout(10000);

  // it('.cryptocrawler.io', async () => {
  //   expect((await isDomainAlive('.cryptocrawler.io', true))[1]).toEqual(false);
  // });

  // it('.tunevideo.ru', async () => {
  //   expect((await isDomainAlive('.tunevideo.ru', true))[1]).toEqual(false);
  // });

  // it('.myqloud.com', async () => {
  //   expect((await isDomainAlive('.myqloud.com', true))[1]).toEqual(true);
  // });

  // it('discount-deal.org', async () => {
  //   expect((await isDomainAlive('discount-deal.org', false))[1]).toEqual(false);
  // });

  // it('ithome.com.tw', async () => {
  //   expect((await isDomainAlive('ithome.com.tw', false))[1]).toEqual(true);
  // });

  // it('flipkart.com', async () => {
  //   expect((await isDomainAlive('flipkart.com', false))[1]).toEqual(true);
  // });

  // it('lzzyimg.com', async () => {
  //   expect((await isDomainAlive('.lzzyimg.com', true))[1]).toEqual(true);
  // });

  // it('tayfundogdas.me', async () => {
  //   expect((await isDomainAlive('.tayfundogdas.me', true))[1]).toEqual(true);
  // });

  it('ecdasoin.it', async () => {
    process.env.DEBUG = 'true';
    expect((await isDomainAlive('.ecdasoin.it', true))[1]).toEqual(false);
  });
});
