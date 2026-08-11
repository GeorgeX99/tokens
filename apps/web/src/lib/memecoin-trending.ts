import type { TimeInterval } from '@/lib/birdeye';
import type { Token } from '@/lib/types';

export const MEMECOIN_TRENDING_DURATIONS = ['5m', '1h', '6h', '24h'] as const;
export type MemecoinTrendingDuration = (typeof MEMECOIN_TRENDING_DURATIONS)[number];
// Default window for the memecoins tab. Kept in sync with the home tab UX.
export const DEFAULT_MEMECOIN_TRENDING_DURATION: MemecoinTrendingDuration = '6h';

export function isMemecoinTrendingDuration(value: string): value is MemecoinTrendingDuration {
    return (MEMECOIN_TRENDING_DURATIONS as readonly string[]).includes(value);
}

/** Chart window length in days for highlight / inline sparklines. */
export function daysForMemecoinDuration(duration: MemecoinTrendingDuration): number {
    switch (duration) {
        case '5m':
            return 5 / (24 * 60);
        case '1h':
            return 1 / 24;
        case '6h':
            return 6 / 24;
        case '24h':
        default:
            return 1;
    }
}

/** Candle size that fits the selected memecoin duration window. */
export function intervalsForMemecoinDuration(duration: MemecoinTrendingDuration): {
    primary: TimeInterval;
    fallback: TimeInterval;
} {
    switch (duration) {
        case '5m':
            return { primary: '1m', fallback: '1m' };
        case '1h':
            return { primary: '1m', fallback: '5m' };
        case '6h':
            return { primary: '5m', fallback: '15m' };
        case '24h':
        default:
            return { primary: '15m', fallback: '1H' };
    }
}

export function volumeForDuration(token: Token, duration: MemecoinTrendingDuration): number {
    switch (duration) {
        case '5m':
            return token.volume5mUSD ?? 0;
        case '1h':
            return token.volume1hUSD ?? 0;
        case '6h':
            return token.volume6hUSD ?? 0;
        case '24h':
        default:
            return token.volume24hUSD;
    }
}

export function changeForDuration(token: Token, duration: MemecoinTrendingDuration): number {
    switch (duration) {
        case '5m':
            return token.priceChange5mPercent ?? token.priceChange1hPercent ?? token.priceChange24hPercent;
        case '1h':
            return token.priceChange1hPercent ?? token.priceChange24hPercent;
        case '6h':
            return token.priceChange6hPercent ?? token.priceChange24hPercent;
        case '24h':
        default:
            return token.priceChange24hPercent;
    }
}

export function tradesForDuration(token: Token, duration: MemecoinTrendingDuration): number {
    switch (duration) {
        case '5m':
            return token.trade5m ?? 0;
        case '1h':
            return token.trade1h ?? 0;
        case '6h':
            return token.trade6h ?? 0;
        case '24h':
        default:
            return token.trade24h ?? 0;
    }
}
