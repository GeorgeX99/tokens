import { NextResponse } from 'next/server';

import {
    DEFAULT_MEMECOIN_TRENDING_DURATION,
    fetchTrendingSolanaMemecoinsPage,
    isMemecoinTrendingDuration,
} from '@/lib/dexscreener-memecoins';

const CACHE_MAX_AGE_SECONDS = 30;
const CACHE_STALE_SECONDS = 120;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const durationRaw = (url.searchParams.get('duration') ?? DEFAULT_MEMECOIN_TRENDING_DURATION).trim();
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize =
        Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_PAGE_SIZE) : undefined;
    const duration = isMemecoinTrendingDuration(durationRaw)
        ? durationRaw
        : DEFAULT_MEMECOIN_TRENDING_DURATION;

    const result = await fetchTrendingSolanaMemecoinsPage({ page, pageSize, duration });

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': `public, s-maxage=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`,
        },
    });
}
