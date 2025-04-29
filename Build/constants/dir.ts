import path from 'node:path';
import process from 'node:process';

export const ROOT_DIR = path.resolve(__dirname, '../..');

export const CACHE_DIR = path.resolve(ROOT_DIR, '.cache');

export const SOURCE_DIR = path.join(ROOT_DIR, 'Source');

export const PUBLIC_DIR = process.env.PUBLIC_DIR || path.resolve(ROOT_DIR, 'public');

export const OUTPUT_SURGE_DIR = path.join(PUBLIC_DIR, 'List');
export const OUTPUT_CLASH_DIR = path.resolve(PUBLIC_DIR, 'Clash');
export const OUTPUT_LEAGCY_CLASH_PREMIUM_DIR = path.resolve(PUBLIC_DIR, 'LegacyClashPremium');
export const OUTPUT_SINGBOX_DIR = path.resolve(PUBLIC_DIR, 'sing-box');
export const OUTPUT_MODULES_DIR = path.resolve(PUBLIC_DIR, 'Modules');
export const OUTPUT_MODULES_RULES_DIR = path.resolve(OUTPUT_MODULES_DIR, 'Rules');
export const OUTPUT_INTERNAL_DIR = path.resolve(PUBLIC_DIR, 'Internal');
export const OUTPUT_MOCK_DIR = path.resolve(PUBLIC_DIR, 'Mock');
