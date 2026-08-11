'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import type { OHLCVData, TimeInterval } from '@/lib/birdeye';

interface UseInlineLatestCloseArgs {
    assetId?: string | null | undefined;
    address: string;
    useCanonicalAssetChart?: boolean;
    /**
     * Must match `InlinePriceChart`'s `fallbackDays` for perfect alignment.
     * When provided, we’ll also consider the extended (1H, N days) OHLCV query.
     */
    fallbackDays?: number;
    /** Must match `InlinePriceChart`'s `days`. Defaults to 1 (24h). */
    days?: number;
    primaryInterval?: TimeInterval;
    fallbackInterval?: TimeInterval;
    preferDexscreener?: boolean;
}

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').trim();
}

function getExtendedDays(fallbackDays: number | undefined, baseDays: number): number | null {
    if (typeof fallbackDays !== 'number' || !Number.isFinite(fallbackDays)) return null;
    if (fallbackDays <= baseDays) return null;
    return Math.min(90, Math.max(baseDays + 1e-9, fallbackDays));
}

function pickLatestClose(data: OHLCVData[] | undefined): number | null {
    if (!data || data.length === 0) return null;

    let bestTime = -Infinity;
    let bestClose: number | null = null;

    for (const point of data) {
        if (!point) continue;
        const { time, close } = point;
        if (!Number.isFinite(time) || !Number.isFinite(close)) continue;
        if (time <= bestTime) continue;
        bestTime = time;
        bestClose = close;
    }

    return bestClose;
}

function getQueryKeyId(key: QueryKey): string {
    if (!Array.isArray(key)) return String(key);
    return key
        .map(part => {
            if (part === null) return 'null';
            if (part === undefined) return 'undefined';
            return String(part);
        })
        .join('|');
}

export function useInlineLatestClose({
    assetId,
    address,
    useCanonicalAssetChart = false,
    fallbackDays,
    days = 1,
    primaryInterval = '15m',
    fallbackInterval = '1H',
    preferDexscreener = false,
}: UseInlineLatestCloseArgs): number | null {
    const queryClient = useQueryClient();

    const { queryKeys, keyIdSet } = useMemo(() => {
        const PRIMARY_INTERVAL: TimeInterval = primaryInterval;
        const FALLBACK_INTERVAL: TimeInterval = fallbackInterval;
        const DAYS = Number.isFinite(days) && days > 0 ? days : 1;

        const normalizedAddress = normalizeText(address);
        const normalizedAssetId = normalizeText(assetId ?? undefined);
        const shouldUseAssetApi = normalizedAssetId.length > 0;
        const shouldUseCanonical = shouldUseAssetApi && useCanonicalAssetChart;

        const extendedDays = getExtendedDays(fallbackDays, DAYS);
        const dexTag = preferDexscreener ? 'dex' : 'platform';

        const keys: QueryKey[] = shouldUseCanonical
            ? [
                  ['assets', 'price-chart', normalizedAssetId, PRIMARY_INTERVAL, DAYS],
                  ['assets', 'price-chart', normalizedAssetId, FALLBACK_INTERVAL, DAYS],
                  ...(extendedDays !== null
                      ? [['assets', 'price-chart', normalizedAssetId, FALLBACK_INTERVAL, extendedDays]]
                      : []),
              ]
            : shouldUseAssetApi
              ? [
                    ['assets', 'ohlcv', normalizedAssetId, normalizedAddress || null, PRIMARY_INTERVAL, DAYS],
                    ['assets', 'ohlcv', normalizedAssetId, normalizedAddress || null, FALLBACK_INTERVAL, DAYS],
                    ...(extendedDays !== null
                        ? [
                              [
                                  'assets',
                                  'ohlcv',
                                  normalizedAssetId,
                                  normalizedAddress || null,
                                  FALLBACK_INTERVAL,
                                  extendedDays,
                              ],
                          ]
                        : []),
                ]
              : [
                    ['ohlcv', normalizedAddress, PRIMARY_INTERVAL, DAYS, dexTag],
                    ['ohlcv', normalizedAddress, FALLBACK_INTERVAL, DAYS, dexTag],
                ];

        const ids = new Set(keys.map(getQueryKeyId));
        return { queryKeys: keys, keyIdSet: ids };
    }, [
        address,
        assetId,
        days,
        fallbackDays,
        fallbackInterval,
        preferDexscreener,
        primaryInterval,
        useCanonicalAssetChart,
    ]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const cache = queryClient.getQueryCache();
            return cache.subscribe(event => {
                const queryKey = event?.query?.queryKey;
                if (!queryKey) return;
                if (keyIdSet.has(getQueryKeyId(queryKey))) onStoreChange();
            });
        },
        [queryClient, keyIdSet],
    );

    return useSyncExternalStore(
        subscribe,
        () => {
            // Match `InlinePriceChart`: primary → fallback → extended.
            const primary = queryClient.getQueryData<OHLCVData[]>(queryKeys[0]);
            if ((primary?.length ?? 0) > 0) return pickLatestClose(primary);

            const fallback = queryClient.getQueryData<OHLCVData[]>(queryKeys[1]);
            if ((fallback?.length ?? 0) > 0) return pickLatestClose(fallback);

            const extendedKey = queryKeys[2];
            if (extendedKey) {
                const extended = queryClient.getQueryData<OHLCVData[]>(extendedKey);
                if ((extended?.length ?? 0) > 0) return pickLatestClose(extended);
            }

            return null;
        },
        () => null,
    );
}
