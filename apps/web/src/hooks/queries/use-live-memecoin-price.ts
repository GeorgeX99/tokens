'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { resolveSupplyFromMarketCap } from '@/components/charts/price-chart-utils';
import type { OHLCVData } from '@/lib/birdeye';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

const POLL_MS = 1_000;
const MAX_TICKS = 1_800; // ~30 minutes of 1s tip

export interface MemecoinLivePriceResponse {
    mint: string;
    price: number;
    priceChange5mPercent: number | null;
    priceChange1hPercent: number | null;
    priceChange24hPercent: number | null;
    liquidityUsd: number | null;
    marketCap: number | null;
    pairAddress: string | null;
    asOf: number;
}

export interface LivePriceTick {
    time: number;
    price: number;
}

async function fetchLivePrice(mint: string, signal?: AbortSignal): Promise<MemecoinLivePriceResponse> {
    const res = await fetch(`/api/memecoins/price?address=${encodeURIComponent(mint)}`, {
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Live price failed (${res.status})`);
    return (await res.json()) as MemecoinLivePriceResponse;
}

/** Turn a stream of price samples into 1s OHLCV candles for the chart tip. */
export function ticksToSecondCandles(ticks: readonly LivePriceTick[]): OHLCVData[] {
    if (ticks.length === 0) return [];

    const bySecond = new Map<number, OHLCVData>();
    for (const tick of ticks) {
        if (!Number.isFinite(tick.time) || !Number.isFinite(tick.price) || tick.price <= 0) continue;
        const time = Math.floor(tick.time);
        const existing = bySecond.get(time);
        if (!existing) {
            bySecond.set(time, {
                time,
                open: tick.price,
                high: tick.price,
                low: tick.price,
                close: tick.price,
                volume: 0,
            });
        } else {
            existing.high = Math.max(existing.high, tick.price);
            existing.low = Math.min(existing.low, tick.price);
            existing.close = tick.price;
        }
    }

    return Array.from(bySecond.values()).sort((a, b) => a.time - b.time);
}

type CandleLike = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | null;
};

/**
 * Append live tip after history. Never drops historical candles that overlap the
 * tip's start — those get closed out and the tip continues forward.
 */
export function mergeCandlesWithLiveTip(history: readonly CandleLike[], liveTip: readonly CandleLike[]): OHLCVData[] {
    const toOhlcv = (candle: CandleLike): OHLCVData => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: typeof candle.volume === 'number' && Number.isFinite(candle.volume) ? candle.volume : 0,
    });

    if (liveTip.length === 0) return history.map(toOhlcv);
    if (history.length === 0) return liveTip.map(toOhlcv);

    const historyEnd = history[history.length - 1]!.time;
    // Keep the entire historical spine; only tip candles strictly after the last history bucket.
    const tip = liveTip.filter(candle => candle.time > historyEnd).map(toOhlcv);
    return [...history.map(toOhlcv), ...tip];
}

export function useLiveMemecoinPrice(
    mint: string,
    options: { enabled?: boolean; seedPrice?: number | null; seedMarketCap?: number | null } = {},
) {
    const normalized = mint.trim();
    const enabled = (options.enabled ?? true) && looksLikeSolanaMintAddress(normalized);
    // Do NOT seed a fake open-time tick — that made charts look like "since page open".
    const [ticks, setTicks] = useState<LivePriceTick[]>([]);
    const lastTickRef = useRef<LivePriceTick | null>(null);

    const query = useQuery({
        queryKey: ['memecoin-live-price', normalized],
        queryFn: ({ signal }) => fetchLivePrice(normalized, signal),
        enabled,
        refetchInterval: POLL_MS,
        refetchIntervalInBackground: false,
        staleTime: 0,
        gcTime: 60_000,
        retry: 1,
    });

    useEffect(() => {
        const quote = query.data;
        if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return;

        const next: LivePriceTick = {
            time: quote.asOf || Math.floor(Date.now() / 1000),
            price: quote.price,
        };
        const prev = lastTickRef.current;
        if (prev && prev.time === next.time && prev.price === next.price) return;
        lastTickRef.current = next;

        setTicks(current => {
            const merged = [...current, next];
            return merged.length > MAX_TICKS ? merged.slice(merged.length - MAX_TICKS) : merged;
        });
    }, [query.data]);

    const liveTipCandles = useMemo(() => ticksToSecondCandles(ticks), [ticks]);
    const price = query.data?.price ?? options.seedPrice ?? null;
    const quotedMarketCap = query.data?.marketCap ?? options.seedMarketCap ?? null;
    const marketCap = useMemo(() => {
        const supply = resolveSupplyFromMarketCap(quotedMarketCap, price);
        if (supply != null && price != null && Number.isFinite(price) && price > 0) {
            return price * supply;
        }
        return quotedMarketCap;
    }, [price, quotedMarketCap]);
    const realtimePoint = useMemo(() => {
        const latest = ticks.at(-1);
        if (!latest) {
            if (options.seedPrice != null && Number.isFinite(options.seedPrice) && options.seedPrice > 0) {
                return { time: Math.floor(Date.now() / 1000), value: options.seedPrice };
            }
            return null;
        }
        return { time: latest.time, value: latest.price };
    }, [options.seedPrice, ticks]);

    return {
        quote: query.data ?? null,
        price,
        marketCap,
        priceChange24hPercent: query.data?.priceChange24hPercent ?? null,
        realtimePoint,
        liveTipCandles,
        ticks,
        isLoading: query.isLoading,
        isError: query.isError,
    };
}
