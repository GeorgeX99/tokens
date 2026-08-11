import type { CuratedTokenListIdWithoutLsts } from '@/lib/curated-token-lists';
import {
    changeForDuration,
    type MemecoinTrendingDuration,
    tradesForDuration,
    volumeForDuration,
} from '@/lib/memecoin-trending';
import type { Token } from '@/lib/types';

export type HomeTabId = 'trending' | 'memecoins' | CuratedTokenListIdWithoutLsts;

export interface HomeHighlightCard {
    id: string;
    title: string;
    token: Token;
    metric: 'price' | 'marketCap' | 'volume1h' | 'volume24h' | 'gainer24h' | 'trades';
    /** Optional override for integer metrics like trade count. */
    metricValue?: number | null;
}

export type HomeHighlightCards = readonly [HomeHighlightCard, HomeHighlightCard, HomeHighlightCard];

function durationLabel(duration: MemecoinTrendingDuration): string {
    return duration.toUpperCase();
}

function pickExclusive(
    tokens: readonly Token[],
    usedAddresses: ReadonlySet<string>,
    score: (token: Token) => number,
): Token | null {
    let best: Token | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const token of tokens) {
        if (usedAddresses.has(token.address)) continue;
        const next = score(token);
        if (!Number.isFinite(next)) continue;
        if (best == null || next > bestScore) {
            best = token;
            bestScore = next;
        }
    }
    return best;
}

/**
 * Memecoin highlight cards for the selected trending timeframe.
 * Order: Trending Now → Biggest Gainer → Most Traded (exclusive mints, no duplicates).
 */
export function createMemecoinHighlights(
    tokens: Token[],
    duration: MemecoinTrendingDuration = '1h',
): HomeHighlightCards {
    const fallback = createFallbackToken();
    const label = durationLabel(duration);

    if (tokens.length === 0) {
        return [
            { id: `trending-now-${duration}`, title: `Trending Now (${label})`, token: fallback, metric: 'marketCap' },
            {
                id: `biggest-gainer-${duration}`,
                title: `Biggest Gainer (${label})`,
                token: fallback,
                metric: 'gainer24h',
            },
            {
                id: `most-traded-${duration}`,
                title: `Most Traded (${label})`,
                token: fallback,
                metric: 'trades',
                metricValue: 0,
            },
        ];
    }

    const used = new Set<string>();

    const trendingNow = tokens[0] ?? fallback;
    used.add(trendingNow.address);

    const biggestGainer =
        pickExclusive(tokens, used, token => changeForDuration(token, duration)) ??
        pickExclusive(tokens, used, () => 1) ??
        fallback;
    used.add(biggestGainer.address);

    // Prefer trade count for the window; if Dex has no txn data, fall back to volume.
    const hasAnyTrades = tokens.some(token => tradesForDuration(token, duration) > 0);
    const mostTraded =
        pickExclusive(tokens, used, token =>
            hasAnyTrades ? tradesForDuration(token, duration) : volumeForDuration(token, duration),
        ) ??
        pickExclusive(tokens, used, () => 1) ??
        fallback;

    const gainerToken: Token = {
        ...biggestGainer,
        priceChange24hPercent: changeForDuration(biggestGainer, duration),
    };

    const tradedCount = tradesForDuration(mostTraded, duration);
    const tradedMetricValue = hasAnyTrades && tradedCount > 0 ? tradedCount : null;
    const tradedCard: HomeHighlightCard =
        tradedMetricValue != null
            ? {
                  id: `most-traded-${duration}`,
                  title: `Most Traded (${label})`,
                  token: mostTraded,
                  metric: 'trades',
                  metricValue: tradedMetricValue,
              }
            : {
                  // Rare fallback when txn data is missing for the whole list.
                  id: `most-active-${duration}`,
                  title: `Most Active (${label})`,
                  token: {
                      ...mostTraded,
                      volume24hUSD: volumeForDuration(mostTraded, duration),
                      volume1hUSD: mostTraded.volume1hUSD,
                  },
                  metric: duration === '1h' ? 'volume1h' : 'volume24h',
              };

    return [
        {
            id: `trending-now-${duration}`,
            title: `Trending Now (${label})`,
            token: trendingNow,
            metric: 'marketCap',
        },
        {
            id: `biggest-gainer-${duration}`,
            title: `Biggest Gainer (${label})`,
            token: gainerToken,
            metric: 'gainer24h',
        },
        tradedCard,
    ];
}

/**
 * Global home highlights, computed across every curated asset (all lists combined) —
 * intentionally independent of whichever tab/table is selected.
 */
export function createHomeHighlights(tokens: Token[], lastAddedAssetId: string | null): HomeHighlightCards {
    const fallback = createFallbackToken();

    if (tokens.length === 0) {
        return [
            { id: 'latest-added', title: 'Latest Added', token: fallback, metric: 'price' },
            { id: 'highest-volume-24h', title: 'Highest Volume (24H)', token: fallback, metric: 'volume24h' },
            { id: 'biggest-gainer-24h', title: 'Biggest Gainer (24H)', token: fallback, metric: 'gainer24h' },
        ];
    }

    const latestAdded =
        lastAddedAssetId !== null
            ? (tokens.find(token => (token.assetId ?? '').trim() === lastAddedAssetId) ?? null)
            : null;

    const hasVolume = (token: Token) => Number.isFinite(token.volume24hUSD) && token.volume24hUSD > 0;

    // Exclude SOL itself and stablecoins (USD & friends would win every day — we want
    // this card to show movement). Falls back to the full pool if the filter empties it.
    const isExcludedFromHighestVolume = (token: Token) =>
        (token.assetId ?? '').trim() === 'solana' || token.category === 'stablecoin';
    const highestVolumeCandidates = tokens.filter(token => !isExcludedFromHighestVolume(token) && hasVolume(token));
    const highestVolumeSource = highestVolumeCandidates.length > 0 ? highestVolumeCandidates : tokens;
    const highestVolume = highestVolumeSource.reduce(
        (best, token) => (token.volume24hUSD > best.volume24hUSD ? token : best),
        highestVolumeSource[0],
    );
    const biggestGainer = tokens.reduce(
        (best, token) => (token.priceChange24hPercent > best.priceChange24hPercent ? token : best),
        tokens[0],
    );
    return [
        { id: 'latest-added', title: 'Latest Added', token: latestAdded ?? fallback, metric: 'price' },
        {
            id: 'highest-volume-24h',
            title: 'Highest Volume (24H)',
            token: highestVolume ?? fallback,
            metric: 'volume24h',
        },
        {
            id: 'biggest-gainer-24h',
            title: 'Biggest Gainer (24H)',
            token: biggestGainer ?? fallback,
            metric: 'gainer24h',
        },
    ];
}

export function createFallbackToken(): Token {
    return {
        address: 'fallback',
        name: 'Token',
        symbol: 'TKN',
        decimals: 9,
        liquidity: 0,
        volume24hUSD: 0,
        price: 0,
        priceChange24hPercent: 0,
        marketCap: 0,
    };
}
