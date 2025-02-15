import 'dns2';

declare module 'dns2' {
  import DNS2 from 'dns2';

  declare namespace DNS2 {
    interface DoHClientOption {
      /** @example dns.google.com */
      dns: string,
      /** @description whether to use HTTP or HTTPS */
      http: boolean
    }

    export type PacketQuestion = keyof typeof Packet.TYPE;
    export type DnsResolver<T = DnsResponse> = (name: string, type: PacketQuestion) => Promise<T>;

    declare function DOHClient(opt: DoHClientOption): DnsResolver;

    export type $DnsResponse = DnsResponse;
  }

  export = DNS2;
}
