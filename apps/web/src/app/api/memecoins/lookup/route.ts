import { NextResponse } from 'next/server';

import { searchSolanaMemecoins } from '@/lib/dexscreener-memecoins';

const CACHE_MAX_AGE_SECONDS = 15;
const CACHE_STALE_SECONDS = 60;
const MAX_RESULTS = 20;

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (!q) {
        return NextResponse.json({ query: '', tokens: [] }, { status: 400 });
    }

    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit =
        Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_RESULTS) : MAX_RESULTS;

    const tokens = await searchSolanaMemecoins(q, limit);

    return NextResponse.json(
        { query: q, tokens },
        {
            headers: {
                'Cache-Control': `public, s-maxage=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`,
            },
        },
    );
}
