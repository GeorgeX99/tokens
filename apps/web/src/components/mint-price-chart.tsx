'use client';

import { memo, useMemo } from 'react';

import { TokenPriceChartCore } from '@/components/charts/token-price-chart-core';
import {
    MEMECOIN_TIME_RANGES,
    normalizeCandles,
    normalizeQueryError,
} from '@/components/charts/price-chart-utils';
import { useMemecoinChartRange } from '@/components/charts/use-memecoin-chart-range';
import { useMemecoinChartHistory } from '@/hooks/queries/use-memecoin-chart-history';
import {
    mergeCandlesWithLiveTip,
    useLiveMemecoinPrice,
} from '@/hooks/queries/use-live-memecoin-price';
import { trackEvent } from '@/lib/posthog-client';

interface MintPriceChartProps {
    mint: string;
    symbol: string;
    tokenName?: string;
    logoURI?: string;
    currentPrice?: number;
    priceChange24h?: number;
    marketCap?: number | null;
}

/** Full token-page chart for mint-only assets (e.g. live DexScreener memecoins with no registry assetId). */
export const MintPriceChart = memo(function MintPriceChart({
    mint,
    symbol,
    tokenName,
    logoURI,
    currentPrice,
    priceChange24h,
    marketCap,
}: MintPriceChartProps) {
    const range = useMemecoinChartRange({
        onTimeRangeChanged: (next, previous) => {
            const label = MEMECOIN_TIME_RANGES.find(r => Math.abs(r.days - next) < 1e-9)?.label ?? `${next}D`;
            trackEvent('chart_timeframe_changed', {
                token_address: mint,
                token_symbol: symbol,
                timeframe_days: next,
                timeframe_label: label,
                previous_timeframe_days: previous,
            });
        },
    });

    // Full history once (not re-fetched per zoom tab). Tabs only change the visible window.
    const historyQuery = useMemecoinChartHistory(mint);
    const live = useLiveMemecoinPrice(mint, { seedPrice: currentPrice, seedMarketCap: marketCap });

    const candles = useMemo(() => {
        const history = normalizeCandles(historyQuery.data ?? []);
        return mergeCandlesWithLiveTip(history, live.liveTipCandles);
    }, [historyQuery.data, live.liveTipCandles]);

    const livePrice = live.price ?? currentPrice;
    const liveChange = live.priceChange24hPercent ?? priceChange24h;
    const liveMarketCap = live.marketCap ?? marketCap ?? null;

    return (
        <TokenPriceChartCore
            candles={candles}
            isLoading={historyQuery.isLoading && candles.length === 0}
            isPending={range.isPending}
            error={normalizeQueryError(historyQuery.error)}
            symbol={symbol}
            tokenName={tokenName}
            logoURI={logoURI}
            currentPrice={livePrice ?? undefined}
            priceChange24h={liveChange ?? undefined}
            marketCap={liveMarketCap}
            defaultValueMode="mcap"
            timeRangeDays={range.deferredTimeRange}
            onTimeRangeChange={range.handleTimeRangeChange}
            timeRanges={range.timeRanges}
            fitWindowToData={candles.length > 0}
            interval="1m"
            showIntervalSelector={false}
            realtimePoint={live.realtimePoint}
            variant="inline-asset"
            shareContext={{ address: mint, mint }}
        />
    );
});
