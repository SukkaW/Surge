import { $$fetch } from './fetch-retry';

export interface RunnerGeoIP {
  ip: string,
  country: string,
  region: string,
  city: string,
  asn: number,
  asOrg: string,
  longitude: number,
  latitude: number,
  timezone: string,
  cfEdgeIP: string
}

/**
 * Fetch the current machine's egress IP and geo info. Used to confirm that
 * each matrix shard landed on a different GitHub-hosted runner region / egress
 * IP — the premise that lets sharding spread DoH load and dodge rate limits.
 *
 * Returns `null` on any failure so it never aborts the actual domain check.
 */
export async function getRunnerGeoIP(): Promise<RunnerGeoIP | null> {
  try {
    const res = await $$fetch('https://ip.api.skk.moe/cf-geoip');
    return await res.json() as RunnerGeoIP;
  } catch {
    return null;
  }
}
