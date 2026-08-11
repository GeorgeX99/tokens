import type { TimeInterval } from '@/lib/birdeye';
import type { PriceCandle } from './price-chart-types';

export const INTERVALS: { label: string; value: TimeInterval }[] = [
    { label: '1H', value: '1H' },
    { label: '4H', value: '4H' },
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
];

export const TIME_RANGES: { label: string; days: number }[] = [
    { label: '24H', days: 1 },
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '1Y', days: 365 },
];

/** Short windows for live memecoins / $SPL — nobody needs a 90D view on a pump mint. */
export const MEMECOIN_TIME_RANGES: { label: string; days: number }[] = [
    { label: '5M', days: 5 / (24 * 60) },
    { label: '15M', days: 15 / (24 * 60) },
    { label: '1H', days: 1 / 24 },
    { label: '6H', days: 6 / 24 },
    { label: '24H', days: 1 },
];

/** Show the fullest available history by default; shorter series still fit-to-data. */
export const DEFAULT_MEMECOIN_TIME_RANGE_DAYS = 1;

export const DEFAULT_CHART_COLOR = '#5c5753';

export function normalizeCandles<T extends Partial<PriceCandle>>(raw: readonly T[] | undefined): PriceCandle[] {
    const candles: PriceCandle[] = [];
    for (const d of raw ?? []) {
        if (
            Number.isFinite(d.time) &&
            Number.isFinite(d.open) &&
            Number.isFinite(d.high) &&
            Number.isFinite(d.low) &&
            Number.isFinite(d.close)
        ) {
            candles.push({
                time: d.time as number,
                open: d.open as number,
                high: d.high as number,
                low: d.low as number,
                close: d.close as number,
                volume: d.volume,
            });
        }
    }
    return candles.sort((a, b) => a.time - b.time);
}

export function normalizeQueryError(error: unknown): string | null {
    return error instanceof Error ? error.message : error ? String(error) : null;
}

export function formatUsdPrice(value: number): string {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs === 0) return '$0.00';
    if (abs < 0.00001) return `$${value.toExponential(2)}`;
    if (abs < 0.01) {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 })}`;
    }
    if (abs < 1) {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact USD for market-cap axis / hero (DexScreener-style $1.23M). */
export function formatUsdMarketCap(value: number): string {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
    return formatUsdPrice(value);
}

/**
 * Implied circulating supply from a live mcap/price quote.
 * Used to scale price candles into a market-cap series.
 */
export function resolveSupplyFromMarketCap(
    marketCap: number | null | undefined,
    price: number | null | undefined,
): number | null {
    if (marketCap == null || price == null) return null;
    if (!Number.isFinite(marketCap) || !Number.isFinite(price) || marketCap <= 0 || price <= 0) return null;
    const supply = marketCap / price;
    return Number.isFinite(supply) && supply > 0 ? supply : null;
}

export function formatEpochSeconds(epochSeconds: number): Date | null {
    if (!Number.isFinite(epochSeconds)) return null;
    return new Date(epochSeconds * 1000);
}

export function findClosestCandleIndex(candles: Array<{ time: number }>, timeSec: number): number | null {
    if (candles.length === 0 || !Number.isFinite(timeSec)) return null;
    let lo = 0;
    let hi = candles.length - 1;

    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (candles[mid]!.time < timeSec) lo = mid + 1;
        else hi = mid;
    }

    const afterIdx = lo;
    const beforeIdx = Math.max(0, afterIdx - 1);
    const after = candles[afterIdx]!;
    const before = candles[beforeIdx]!;

    if (beforeIdx === afterIdx) return afterIdx;
    return Math.abs(after.time - timeSec) < Math.abs(timeSec - before.time) ? afterIdx : beforeIdx;
}

export function formatPointDateLabel(epochSeconds: number, rangeDays: number): string {
    const d = formatEpochSeconds(epochSeconds);
    if (!d) return '';
    if (rangeDays <= 1 / 24) {
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }
    if (rangeDays <= 1) {
        return d.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatAxisTimeLabel(epochSeconds: number, rangeDays: number): string {
    const d = formatEpochSeconds(epochSeconds);
    if (!d) return '';
    if (rangeDays <= 1 / 24) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (rangeDays <= 1) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (rangeDays >= 365) return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export function pickIntervalForDays(days: number): TimeInterval {
    const windowSecs = days * 24 * 60 * 60;
    const candidates: Array<{ interval: TimeInterval; secs: number }> = [
        { interval: '1H', secs: 60 * 60 },
        { interval: '4H', secs: 4 * 60 * 60 },
        { interval: '1D', secs: 24 * 60 * 60 },
        { interval: '1W', secs: 7 * 24 * 60 * 60 },
    ];
    const maxPoints = 800;
    for (const c of candidates) {
        if (windowSecs / c.secs <= maxPoints) return c.interval;
    }
    return '1W';
}

/** Fine buckets for memecoin / live mint charts. Prefer 1m — public 1s feeds are flaky. */
export function pickMemecoinIntervalForDays(days: number): TimeInterval {
    const windowSecs = days * 24 * 60 * 60;
    if (windowSecs <= 2 * 60 * 60) return '1m';
    if (windowSecs <= 6 * 60 * 60) return '5m';
    return '15m';
}

/**
 * Liveline's default Y domain collapses micro-prices (~1e-5) to a flat $0 line
 * with a useless ±0.16 axis. Scale so the series sits in a normal numeric range.
 */
export function pickMicroPriceScale(values: ReadonlyArray<number | null | undefined>): number {
    let max = 0;
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value) && value > max) max = value;
    }
    if (max <= 0 || max >= 0.01) return 1;
    return 10 ** Math.ceil(-Math.log10(max));
}

/** Zoom Liveline to the actual series when history is shorter than the selected tab. */
export function resolveChartWindowSeconds(args: {
    selectedWindowSecs: number;
    candles: ReadonlyArray<{ time: number }>;
    candleWidthSeconds: number;
    fitToData: boolean;
}): number {
    const selected = Math.max(1, args.selectedWindowSecs);
    if (!args.fitToData || args.candles.length < 2) return selected;

    const first = args.candles[0]?.time;
    const last = args.candles[args.candles.length - 1]?.time;
    if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last) || last <= first) {
        return selected;
    }

    const dataSpan = last - first;
    // New / thin tokens: stretch whatever candles we have across the full width.
    // Never inflate past the data span — a minSpan > dataSpan crushes the line to the right.
    // Slight bump accounts for Liveline's no-badge right buffer (~1.5%).
    if (dataSpan < selected) {
        const candleFloor = Math.max(1, args.candleWidthSeconds);
        return Math.max(dataSpan, candleFloor) / (1 - 0.015);
    }
    return selected;
}
