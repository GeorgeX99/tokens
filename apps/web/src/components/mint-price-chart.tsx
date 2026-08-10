'use client';

import { memo, useMemo } from 'react';

import { TokenPriceChartCore } from '@/components/charts/token-price-chart-core';
import { normalizeCandles, normalizeQueryError, TIME_RANGES } from '@/components/charts/price-chart-utils';
import { useAutoChartRange } from '@/components/charts/use-auto-chart-range';
import { useOHLCV } from '@/hooks/queries/use-ohlcv';
import { trackEvent } from '@/lib/posthog-client';

interface MintPriceChartProps {
    mint: string;
    symbol: string;
    tokenName?: string;
    logoURI?: string;
    currentPrice?: number;
    priceChange24h?: number;
}

/** Full token-page chart for mint-only assets (e.g. live DexScreener memecoins with no registry assetId). */
export const MintPriceChart = memo(function MintPriceChart({
    mint,
    symbol,
    tokenName,
    logoURI,
    currentPrice,
    priceChange24h,
}: MintPriceChartProps) {
    const range = useAutoChartRange({
        onTimeRangeChanged: (next, previous) => {
            const rangeLabel = TIME_RANGES.find(r => r.days === next)?.label ?? `${next}D`;
            trackEvent('chart_timeframe_changed', {
                token_address: mint,
                token_symbol: symbol,
                timeframe_days: next,
                timeframe_label: rangeLabel,
                previous_timeframe_days: previous,
            });
        },
    });

    const query = useOHLCV(mint, range.interval, range.deferredTimeRange, { preferDexscreener: true });
    const candles = useMemo(() => normalizeCandles(query.data ?? []), [query.data]);

    return (
        <TokenPriceChartCore
            candles={candles}
            isLoading={query.isLoading}
            isPending={range.isPending}
            error={normalizeQueryError(query.error)}
            symbol={symbol}
            tokenName={tokenName}
            logoURI={logoURI}
            currentPrice={currentPrice}
            priceChange24h={priceChange24h}
            timeRangeDays={range.deferredTimeRange}
            onTimeRangeChange={range.handleTimeRangeChange}
            interval={range.interval}
            showIntervalSelector={false}
            realtimePoint={null}
            variant="inline-asset"
            shareContext={{ address: mint, mint }}
        />
    );
});
