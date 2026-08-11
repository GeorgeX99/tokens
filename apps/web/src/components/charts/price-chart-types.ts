import type { TimeInterval } from '@/lib/birdeye';

export interface PriceCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | null;
}

export interface PriceChartShareContext {
    address?: string;
    assetId?: string;
    mint?: string;
    coinId?: string;
}

export interface ChartTimeRangeOption {
    label: string;
    days: number;
}

/** Primary Y-axis / hero metric for memecoin-style charts. */
export type ChartValueMode = 'price' | 'mcap';

export interface TokenPriceChartCoreProps {
    candles: PriceCandle[];
    isLoading: boolean;
    isPending?: boolean;
    error: string | null;
    symbol: string;
    tokenName?: string;
    logoURI?: string;
    currentPrice?: number;
    priceChange24h?: number;
    /**
     * Latest market cap (USD). When set with a positive price, enables Price | MCap
     * toggle and defaults the hero + series to market cap (memecoin convention).
     */
    marketCap?: number | null;
    /** Override default value mode. Defaults to `mcap` when marketCap is available. */
    defaultValueMode?: ChartValueMode;
    timeRangeDays: number;
    onTimeRangeChange: (days: number) => void;
    /** Override the default 24H/7D/… selector (e.g. memecoin 5M/15M/1H). */
    timeRanges?: readonly ChartTimeRangeOption[];
    /** Zoom the visible window to the candle series instead of empty whitespace. */
    fitWindowToData?: boolean;
    interval?: TimeInterval;
    onIntervalChange?: (interval: TimeInterval) => void;
    showIntervalSelector: boolean;
    realtimePoint?: { time: number; value: number } | null;
    variant: 'card' | 'inline-asset';
    shareContext: PriceChartShareContext;
}
