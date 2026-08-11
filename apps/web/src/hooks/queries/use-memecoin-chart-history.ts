'use client';

import { useQuery } from '@tanstack/react-query';
import { Effect } from 'effect';

import { apiJson } from '@/effect/api-client';
import type { OHLCVData } from '@/lib/birdeye';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

/** Pull the fullest free history we can (1m spine + trade densify), independent of the zoom tab. */
async function fetchFullMemecoinHistory(mint: string, signal?: AbortSignal): Promise<OHLCVData[]> {
    const now = Math.floor(Date.now() / 1000);
    // 24h is enough for memecoins; brand-new mints return everything since pool create.
    const from = now - 24 * 60 * 60;
    const params = new URLSearchParams({
        address: mint,
        interval: '1m',
        from: String(from),
        to: String(now),
    });

    return await Effect.runPromise(
        apiJson<OHLCVData[]>({
            url: `/api/memecoins/ohlcv?${params.toString()}`,
        }),
        { signal },
    );
}

export function useMemecoinChartHistory(mint: string, options: { enabled?: boolean } = {}) {
    const normalized = mint.trim();
    const enabled = (options.enabled ?? true) && looksLikeSolanaMintAddress(normalized);

    return useQuery({
        queryKey: ['memecoin-chart-history', normalized],
        queryFn: ({ signal }) => fetchFullMemecoinHistory(normalized, signal),
        enabled,
        staleTime: 20_000,
        refetchInterval: query => {
            const empty = !query.state.data || query.state.data.length === 0;
            return empty ? 8_000 : 30_000;
        },
        retry: 2,
    });
}
