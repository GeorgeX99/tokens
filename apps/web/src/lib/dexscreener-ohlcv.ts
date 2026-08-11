import 'server-only';

import type { OHLCVData, TimeInterval } from '@/lib/birdeye';

const DEXSCREENER_ORIGIN = 'https://api.dexscreener.com';
const GECKOTERMINAL_ORIGIN = 'https://api.geckoterminal.com';
const PUMP_FRONTEND_ORIGIN = 'https://frontend-api-v3.pump.fun';
const PUMP_SWAP_ORIGIN = 'https://swap-api.pump.fun';
const SOLANA_CHAIN_ID = 'solana';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_CANDLES = 1000;
const MAX_OHLCV_PAGES = 8;
const MAX_TRADE_PAGES = 8;
const TRADES_PER_PAGE = 100;
/** Cap free history so a single request stays responsive. */
const MAX_HISTORY_SECONDS = 7 * 24 * 60 * 60;

interface DexscreenerPair {
    chainId?: string;
    pairAddress?: string;
    baseToken?: { address?: string };
    liquidity?: { usd?: number };
    pairCreatedAt?: number;
}

/** GeckoTerminal returns `[timestamp, open, high, low, close, volume]` newest-first. */
type GeckoOhlcvRow = [number, number, number, number, number, number];

interface GeckoTrade {
    attributes?: {
        block_timestamp?: string;
        price_usd?: string;
        volume_in_usd?: string;
    };
}

interface PumpCandle {
    timestamp?: number;
    open?: string | number;
    high?: string | number;
    low?: string | number;
    close?: string | number;
    volume?: string | number;
}

function mapIntervalToGecko(interval: TimeInterval): {
    timeframe: 'second' | 'minute' | 'hour' | 'day';
    aggregate: number;
} {
    switch (interval) {
        case '1s':
            return { timeframe: 'second', aggregate: 1 };
        case '1m':
            return { timeframe: 'minute', aggregate: 1 };
        case '5m':
            return { timeframe: 'minute', aggregate: 5 };
        case '15m':
            return { timeframe: 'minute', aggregate: 15 };
        case '1H':
            return { timeframe: 'hour', aggregate: 1 };
        case '4H':
            return { timeframe: 'hour', aggregate: 4 };
        case '1D':
            return { timeframe: 'day', aggregate: 1 };
        case '1W':
            return { timeframe: 'day', aggregate: 7 };
        default:
            return { timeframe: 'minute', aggregate: 1 };
    }
}

function intervalSeconds(interval: TimeInterval): number {
    switch (interval) {
        case '1s':
            return 1;
        case '1m':
            return 60;
        case '5m':
            return 5 * 60;
        case '15m':
            return 15 * 60;
        case '1H':
            return 60 * 60;
        case '4H':
            return 4 * 60 * 60;
        case '1D':
            return 24 * 60 * 60;
        case '1W':
            return 7 * 24 * 60 * 60;
        default:
            return 60;
    }
}

/** Pump swap-api candle intervals we can ask for. */
function mapIntervalToPump(interval: TimeInterval): '1s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' {
    switch (interval) {
        case '1s':
            return '1s';
        case '1m':
            return '1m';
        case '5m':
            return '5m';
        case '15m':
            return '15m';
        case '1H':
            return '1h';
        case '4H':
            return '4h';
        case '1D':
        case '1W':
            return '1d';
        default:
            return '1m';
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: {
                accept: 'application/json',
                'user-agent': 'Mozilla/5.0 (compatible; SPLTokenChart/1.0)',
                ...(init?.headers ?? {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            ...init,
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

async function fetchBestSolanaPool(mint: string): Promise<{ poolAddress: string; createdAtSec: number | null } | null> {
    const pairs = await fetchJson<DexscreenerPair[]>(
        `${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${mint}`,
    );
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    const solanaPairs = pairs.filter(
        pair => pair.chainId === SOLANA_CHAIN_ID && pair.baseToken?.address === mint && pair.pairAddress,
    );
    if (solanaPairs.length === 0) return null;

    const best = solanaPairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
    const poolAddress = best.pairAddress?.trim();
    if (!poolAddress) return null;

    const createdMs = best.pairCreatedAt;
    const createdAtSec =
        typeof createdMs === 'number' && Number.isFinite(createdMs) && createdMs > 0
            ? Math.floor(createdMs / 1000)
            : null;

    return { poolAddress, createdAtSec };
}

function rowsToCandles(rows: GeckoOhlcvRow[], from: number, to: number): OHLCVData[] {
    const all: OHLCVData[] = [];
    for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const [time, open, high, low, close, volume] = row;
        if (
            typeof time !== 'number' ||
            !Number.isFinite(time) ||
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            continue;
        }
        all.push({
            time,
            open,
            high,
            low,
            close,
            volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 0,
        });
    }
    all.sort((a, b) => a.time - b.time);

    const filtered = all.filter(candle => candle.time >= from && candle.time <= to);
    // Never throw away the only history a brand-new mint has because of a tight window.
    return filtered.length > 0 ? filtered : all;
}

async function fetchTradeCandles(
    poolAddress: string,
    from: number,
    to: number,
    bucketSecs: number,
): Promise<OHLCVData[]> {
    const byBucket = new Map<number, OHLCVData>();
    const bucket = Math.max(1, bucketSecs);

    for (let page = 1; page <= MAX_TRADE_PAGES; page++) {
        const url =
            `${GECKOTERMINAL_ORIGIN}/api/v2/networks/solana/pools/${encodeURIComponent(poolAddress)}` +
            `/trades?limit=${TRADES_PER_PAGE}&page=${page}`;
        const body = await fetchJson<{ data?: GeckoTrade[] }>(url);
        const trades = body?.data;
        if (!Array.isArray(trades) || trades.length === 0) break;

        let oldestInPage = Number.POSITIVE_INFINITY;
        for (const trade of trades) {
            const tsRaw = trade.attributes?.block_timestamp;
            const priceRaw = trade.attributes?.price_usd;
            if (!tsRaw || !priceRaw) continue;
            const time = Math.floor(Date.parse(tsRaw) / 1000);
            const price = Number.parseFloat(priceRaw);
            const volume = Number.parseFloat(trade.attributes?.volume_in_usd ?? '0');
            if (!Number.isFinite(time) || !Number.isFinite(price) || price <= 0) continue;
            oldestInPage = Math.min(oldestInPage, time);
            if (time < from || time > to) continue;

            const key = Math.floor(time / bucket) * bucket;
            const existing = byBucket.get(key);
            if (!existing) {
                byBucket.set(key, {
                    time: key,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: Number.isFinite(volume) ? volume : 0,
                });
            } else {
                existing.high = Math.max(existing.high, price);
                existing.low = Math.min(existing.low, price);
                existing.close = price;
                existing.volume += Number.isFinite(volume) ? volume : 0;
            }
        }

        if (oldestInPage < from) break;
        if (trades.length < TRADES_PER_PAGE) break;
    }

    return Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
}

async function fetchGeckoOhlcv(
    poolAddress: string,
    interval: TimeInterval,
    from: number,
    to: number,
): Promise<OHLCVData[]> {
    const { timeframe, aggregate } = mapIntervalToGecko(interval);
    const bucketSecs = Math.max(1, intervalSeconds(interval));
    const limit = Math.min(MAX_CANDLES, Math.max(50, Math.ceil((to - from) / bucketSecs) + 10));

    // Page backwards with before_timestamp so we actually fill the window.
    const collected = new Map<number, OHLCVData>();
    let before: number | undefined = to + 1;

    for (let page = 0; page < MAX_OHLCV_PAGES; page++) {
        const url = new URL(
            `${GECKOTERMINAL_ORIGIN}/api/v2/networks/solana/pools/${encodeURIComponent(poolAddress)}/ohlcv/${timeframe}`,
        );
        url.searchParams.set('aggregate', String(aggregate));
        url.searchParams.set('limit', String(Math.min(1000, limit)));
        url.searchParams.set('currency', 'usd');
        url.searchParams.set('token', 'base');
        if (before != null) url.searchParams.set('before_timestamp', String(before));

        const body = await fetchJson<{
            data?: { attributes?: { ohlcv_list?: GeckoOhlcvRow[] } };
        }>(url.toString());

        const rows = body?.data?.attributes?.ohlcv_list;
        if (!Array.isArray(rows) || rows.length === 0) break;

        const pageCandles = rowsToCandles(rows, from, to);
        if (pageCandles.length === 0) {
            const rawTimes = rows
                .map(row => (Array.isArray(row) ? row[0] : null))
                .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
            const oldestRaw = rawTimes.length > 0 ? Math.min(...rawTimes) : null;
            if (oldestRaw == null || oldestRaw <= from) break;
            before = oldestRaw;
            continue;
        }

        for (const candle of pageCandles) collected.set(candle.time, candle);

        const oldest = pageCandles[0]!.time;
        if (oldest <= from) break;
        if (rows.length < Math.min(1000, limit)) break;
        before = oldest;
    }

    return Array.from(collected.values()).sort((a, b) => a.time - b.time);
}

function mergeCandleSeries(primary: OHLCVData[], secondary: OHLCVData[]): OHLCVData[] {
    const byTime = new Map<number, OHLCVData>();
    for (const candle of secondary) byTime.set(candle.time, candle);
    for (const candle of primary) byTime.set(candle.time, candle);
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function parsePumpNumber(value: string | number | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.length === 0) return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Pump.fun / PumpSwap candles — full history since launch, no Gecko rate limit.
 * Works for bonding-curve and graduated coins that still expose the mint on pump APIs.
 */
async function fetchPumpFunOhlcv(mint: string, interval: TimeInterval): Promise<OHLCVData[]> {
    const meta = await fetchJson<{ created_timestamp?: number }>(
        `${PUMP_FRONTEND_ORIGIN}/coins/${encodeURIComponent(mint)}`,
    );
    const createdTs = meta?.created_timestamp;
    if (typeof createdTs !== 'number' || !Number.isFinite(createdTs) || createdTs <= 0) {
        return [];
    }

    // Prefer 1m spine for chart history; denser 1s only when explicitly asked.
    const pumpInterval = interval === '1s' ? '1s' : mapIntervalToPump(interval === '1m' ? '1m' : interval);
    const primaryInterval = interval === '1s' ? '1s' : '1m';

    const fetchInterval = async (iv: string): Promise<OHLCVData[]> => {
        const url =
            `${PUMP_SWAP_ORIGIN}/v2/coins/${encodeURIComponent(mint)}/candles` +
            `?interval=${encodeURIComponent(iv)}&limit=1000&createdTs=${createdTs}`;
        const rows = await fetchJson<PumpCandle[]>(url);
        if (!Array.isArray(rows) || rows.length === 0) return [];

        const candles: OHLCVData[] = [];
        for (const row of rows) {
            const tsMs = row.timestamp;
            if (typeof tsMs !== 'number' || !Number.isFinite(tsMs)) continue;
            const open = parsePumpNumber(row.open);
            const high = parsePumpNumber(row.high);
            const low = parsePumpNumber(row.low);
            const close = parsePumpNumber(row.close);
            const volume = parsePumpNumber(row.volume) ?? 0;
            if (open == null || high == null || low == null || close == null) continue;
            if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
            candles.push({
                time: Math.floor(tsMs / 1000),
                open,
                high,
                low,
                close,
                volume,
            });
        }
        candles.sort((a, b) => a.time - b.time);
        return candles;
    };

    // Always get the full 1m (or 1s) history first.
    let series = await fetchInterval(primaryInterval);

    // If caller wanted coarser buckets and pump returned them denser, prefer those when long enough.
    if (pumpInterval !== primaryInterval) {
        const coarse = await fetchInterval(pumpInterval);
        if (coarse.length >= Math.max(8, series.length * 0.35)) {
            series = coarse;
        }
    }

    return series;
}

async function fetchGeckoFallback(args: {
    mint: string;
    interval: TimeInterval;
    from: number;
    to: number;
}): Promise<OHLCVData[]> {
    const pool = await fetchBestSolanaPool(args.mint);
    if (!pool) return [];

    const to = Math.max(1, args.to);
    const historyFrom =
        pool.createdAtSec != null && pool.createdAtSec > 0
            ? Math.max(pool.createdAtSec, to - MAX_HISTORY_SECONDS)
            : Math.max(0, Math.min(args.from, to - MAX_HISTORY_SECONDS));

    const minuteHistory = await fetchGeckoOhlcv(pool.poolAddress, '1m', historyFrom, to);
    const tradeBucket =
        args.interval === '1s' ? 1 : args.interval === '1m' ? 15 : Math.min(60, intervalSeconds(args.interval));
    const tradeHistory = await fetchTradeCandles(pool.poolAddress, historyFrom, to, tradeBucket);

    let series = mergeCandleSeries(minuteHistory, tradeHistory);

    if (args.interval !== '1m' && args.interval !== '1s') {
        const coarse = await fetchGeckoOhlcv(pool.poolAddress, args.interval, historyFrom, to);
        if (coarse.length >= Math.max(8, series.length * 0.5)) {
            series = mergeCandleSeries(coarse, tradeHistory);
        }
    }

    if (series.length > 0) return series;
    return await fetchGeckoOhlcv(pool.poolAddress, '1m', 0, to);
}

/**
 * Full chart history for a Solana mint.
 * Prefers Pump.fun candles (full launch history), then GeckoTerminal + trades.
 */
export async function fetchDexscreenerOhlcv(args: {
    mint: string;
    interval: TimeInterval;
    from: number;
    to: number;
}): Promise<OHLCVData[]> {
    // Return the full launch history; timeframe tabs only zoom the client window.
    const pump = await fetchPumpFunOhlcv(args.mint, args.interval);
    if (pump.length > 0) return pump;

    return await fetchGeckoFallback(args);
}
