import { useQuery } from '@tanstack/react-query';
import { Effect } from 'effect';
import { ApiResponseError, apiJson } from '@/effect/api-client';
import type { OHLCVData, TimeInterval } from '@/lib/birdeye';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';
import { alignEpochSeconds } from '@/lib/time';

interface UseOHLCVOptions {
    enabled?: boolean;
    /**
     * Prefer DexScreener-reconstructed candles (for live memecoins that are not in
     * the platform OHLCV cache). When false, still falls back to DexScreener if the
     * platform returns an empty series.
     */
    preferDexscreener?: boolean;
}

interface AssetIncludeOk<T> {
    ok: true;
    data: T;
}

interface AssetIncludeError {
    ok: false;
    reason: string;
    message: string;
}

type AssetIncludeResult<T> = AssetIncludeOk<T> | AssetIncludeError;

interface AssetOhlcvResponse {
    includes?: {
        ohlcv?: AssetIncludeResult<OHLCVData[]>;
    };
}

function shouldRetryOhlcvQuery(failureCount: number, error: unknown): boolean {
    if (error instanceof ApiResponseError) {
        // These are not transient for the client; retrying just increases load and makes rate limits worse.
        if ([400, 401, 403, 429].includes(error.status)) return false;
    }

    return failureCount < 2;
}

/** Platform singleton asset ids for mint-only tokens (see apps/api `_singleton-asset-id.ts`). */
function mintToSingletonAssetId(mint: string): string {
    return `solana-${mint}`;
}

async function fetchPlatformOhlcv(
    mint: string,
    interval: TimeInterval,
    from: number,
    to: number,
    signal?: AbortSignal,
): Promise<OHLCVData[]> {
    const assetId = mintToSingletonAssetId(mint);
    const params = new URLSearchParams({
        include: 'ohlcv',
        mint,
        ohlcvInterval: interval,
        ohlcvFrom: String(from),
        ohlcvTo: String(to),
    });

    const data = await Effect.runPromise(
        apiJson<AssetOhlcvResponse>({
            url: `/api/v1/assets/${encodeURIComponent(assetId)}?${params.toString()}`,
        }),
        { signal },
    );

    const include = data.includes?.ohlcv;
    if (!include) return [];
    if (!include.ok) return [];
    return include.data;
}

async function fetchDexscreenerOhlcv(
    mint: string,
    interval: TimeInterval,
    from: number,
    to: number,
    signal?: AbortSignal,
): Promise<OHLCVData[]> {
    const params = new URLSearchParams({
        address: mint,
        interval,
        from: String(from),
        to: String(to),
    });
    return await Effect.runPromise(
        apiJson<OHLCVData[]>({
            url: `/api/memecoins/ohlcv?${params.toString()}`,
        }),
        { signal },
    );
}

export function useOHLCV(address: string, interval: TimeInterval, days: number, options: UseOHLCVOptions = {}) {
    const { enabled = true, preferDexscreener = false } = options;
    const normalizedAddress = address.trim();
    const isValidAddress = looksLikeSolanaMintAddress(normalizedAddress);

    return useQuery<OHLCVData[]>({
        queryKey: ['ohlcv', normalizedAddress, interval, days, preferDexscreener ? 'dex' : 'platform'],
        queryFn: async ({ signal }) => {
            // Align timestamps so retries/remounts don't generate new URLs every second.
            // Fine memecoin windows (≤15m / 1s ticks) align to 1s; coarser to 60s.
            const windowSecs = Math.max(1, days * 24 * 60 * 60);
            const alignTo = windowSecs <= 15 * 60 || interval === '1s' ? 1 : 60;
            const now = alignEpochSeconds(Math.floor(Date.now() / 1000), alignTo);
            const from = alignEpochSeconds(now - Math.ceil(windowSecs), alignTo);

            if (preferDexscreener) {
                return await fetchDexscreenerOhlcv(normalizedAddress, interval, from, now, signal);
            }

            // Public assets API first (assets:read). Legacy `/api/ohlcv` needs `internal:read`.
            try {
                const platformCandles = await fetchPlatformOhlcv(normalizedAddress, interval, from, now, signal);
                if (platformCandles.length > 0) return platformCandles;
            } catch {
                // Fall through to DexScreener reconstruction for uncached memecoins.
            }

            return await fetchDexscreenerOhlcv(normalizedAddress, interval, from, now, signal);
        },
        enabled: enabled && isValidAddress,
        retry: shouldRetryOhlcvQuery,
        // History refresh — live tip comes from DexScreener 1s polling separately.
        refetchInterval: query => {
            if (!preferDexscreener) return false;
            const empty = !query.state.data || query.state.data.length === 0;
            if (empty) return 8_000;
            if (interval === '1m' || interval === '1s') return 20_000;
            return 45_000;
        },
    });
}
