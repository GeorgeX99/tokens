import 'server-only';

import type { OHLCVData, TimeInterval } from '@/lib/birdeye';

const DEXSCREENER_ORIGIN = 'https://api.dexscreener.com';
const GECKOTERMINAL_ORIGIN = 'https://api.geckoterminal.com';
const SOLANA_CHAIN_ID = 'solana';
const FETCH_TIMEOUT_MS = 8_000;
const REVALIDATE_SECONDS = 30;
const MAX_CANDLES = 1000;

interface DexscreenerPair {
    chainId?: string;
    pairAddress?: string;
    baseToken?: { address?: string };
    liquidity?: { usd?: number };
}

/** GeckoTerminal returns `[timestamp, open, high, low, close, volume]` newest-first. */
type GeckoOhlcvRow = [number, number, number, number, number, number];

function mapIntervalToGecko(interval: TimeInterval): { timeframe: 'minute' | 'hour' | 'day'; aggregate: number } {
    switch (interval) {
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
            return { timeframe: 'minute', aggregate: 15 };
    }
}

async function fetchJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: { accept: 'application/json' },
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

async function fetchBestSolanaPoolAddress(mint: string): Promise<string | null> {
    const pairs = await fetchJson<DexscreenerPair[]>(
        `${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${mint}`,
    );
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    const solanaPairs = pairs.filter(
        pair => pair.chainId === SOLANA_CHAIN_ID && pair.baseToken?.address === mint && pair.pairAddress,
    );
    if (solanaPairs.length === 0) return null;

    const best = solanaPairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
    return best.pairAddress?.trim() || null;
}

/**
 * Real OHLCV for a Solana mint via GeckoTerminal pool candles.
 * DexScreener is only used to discover the highest-liquidity pool address.
 */
export async function fetchDexscreenerOhlcv(args: {
    mint: string;
    interval: TimeInterval;
    from: number;
    to: number;
}): Promise<OHLCVData[]> {
    const poolAddress = await fetchBestSolanaPoolAddress(args.mint);
    if (!poolAddress) return [];

    const { timeframe, aggregate } = mapIntervalToGecko(args.interval);
    const limit = Math.min(
        MAX_CANDLES,
        Math.max(10, Math.ceil((args.to - args.from) / Math.max(60, aggregate * (timeframe === 'day' ? 86400 : timeframe === 'hour' ? 3600 : 60))) + 5),
    );

    const url =
        `${GECKOTERMINAL_ORIGIN}/api/v2/networks/solana/pools/${encodeURIComponent(poolAddress)}` +
        `/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=base`;

    const body = await fetchJson<{
        data?: { attributes?: { ohlcv_list?: GeckoOhlcvRow[] } };
    }>(url);

    const rows = body?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const candles: OHLCVData[] = [];
    for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const [time, open, high, low, close, volume] = row;
        if (
            typeof time !== 'number' ||
            !Number.isFinite(time) ||
            time < args.from ||
            time > args.to ||
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            continue;
        }
        candles.push({
            time,
            open,
            high,
            low,
            close,
            volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 0,
        });
    }

    // GeckoTerminal returns newest-first; charts expect ascending time.
    candles.sort((a, b) => a.time - b.time);
    return candles;
}
