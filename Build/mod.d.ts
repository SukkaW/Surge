declare module 'gorhill-publicsuffixlist' {
  type Selfie =
    | string
    | {
        magic: number;
        buf32: number[];
      };
  interface Decoder {
    decode: (bufferStr: string, buffer: ArrayBuffer) => void;
    decodeSize: (bufferStr: string) => number;
  }
  interface Encoder {
    encode: (buffer: ArrayBuffer, length: number) => string;
  }
  export interface PublicSuffixList {
    version: string;

    parse(text: string, toAscii: (input: string) => string): void;

    getPublicSuffix(hostname: string): string;
    getDomain(hostname: string): string;

    suffixInPSL(hostname: string): boolean;

    toSelfie(encoder?: null | Encoder): Selfie;
    fromSelfie(selfie: Selfie, decoder?: null | Decoder): boolean;

    enableWASM(options?: {
      customFetch?: null | ((url: URL) => Promise<Blob>);
    }): Promise<boolean>;
    disableWASM(): Promise<boolean>;
  }

  const psl: PublicSuffixList;
  export default psl;
}
