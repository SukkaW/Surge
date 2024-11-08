import 'dns2';

declare module 'dns2' {
  import DNS from 'dns2';

  declare namespace DNS {
    interface DoHClientOption {
      /** @example dns.google.com */
      dns: string,
      /** @description whether to use HTTP or HTTPS */
      http: boolean,

      get?: (url: string) => any
    }

    export type DnsResolver<T = DnsResponse> = (name: string, type: PacketQuestion) => Promise<T>;

    declare function DOHClient(opt: DoHClientOption): DnsResolver;

    export type $DnsResponse = DnsResponse;
  }

  export = DNS;
}
