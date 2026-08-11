import { NextResponse } from 'next/server';

import { fetchDexscreenerOhlcv } from '@/lib/dexscreener-ohlcv';
import type { TimeInterval } from '@/lib/birdeye';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

const CACHE_MAX_AGE_SECONDS = 30;
const CACHE_STALE_SECONDS = 120;

const VALID_INTERVALS = new Set<TimeInterval>(['1s', '1m', '5m', '15m', '1H', '4H', '1D', '1W']);

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const mint = (url.searchParams.get('address') ?? url.searchParams.get('mint') ?? '').trim();
    if (!looksLikeSolanaMintAddress(mint)) {
        return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 });
    }

    const rawInterval = (url.searchParams.get('interval') ?? '15m').trim() as TimeInterval;
    const interval = VALID_INTERVALS.has(rawInterval) ? rawInterval : ('15m' as const);

    const now = Math.floor(Date.now() / 1000);
    const fromRaw = Number.parseInt(url.searchParams.get('from') ?? '', 10);
    const toRaw = Number.parseInt(url.searchParams.get('to') ?? '', 10);
    const from = Number.isFinite(fromRaw) && fromRaw > 0 ? fromRaw : now - 24 * 60 * 60;
    const to = Number.isFinite(toRaw) && toRaw > 0 ? toRaw : now;

    const candles = await fetchDexscreenerOhlcv({ mint, interval, from, to });

    // Don't let empty upstream failures (429/401) stick in the CDN/browser for half a minute.
    const cacheControl =
        candles.length > 0
            ? `public, s-maxage=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`
            : 'public, s-maxage=0, stale-while-revalidate=5';

    return NextResponse.json(candles, {
        headers: {
            'Cache-Control': cacheControl,
        },
    });
}
