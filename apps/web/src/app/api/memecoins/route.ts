import { NextResponse } from 'next/server';

import { fetchTrendingSolanaMemecoins } from '@/lib/dexscreener-memecoins';

const CACHE_MAX_AGE_SECONDS = 30;
const CACHE_STALE_SECONDS = 120;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
    const limitParam = new URL(request.url).searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : undefined;

    const tokens = await fetchTrendingSolanaMemecoins(limit);

    return NextResponse.json(
        { tokens },
        {
            headers: {
                'Cache-Control': `public, s-maxage=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`,
            },
        },
    );
}
