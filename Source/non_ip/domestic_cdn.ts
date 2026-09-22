import type { DNSMapping } from './direct';

// CDN domains of domestic services that should use DIRECT both in China and abroad.
// These domains are also included in the legacy domestic output by the build script.
export const DOMESTIC_CDN: Record<string, DNSMapping> = {};
