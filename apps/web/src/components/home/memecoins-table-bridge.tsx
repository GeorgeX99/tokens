'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { HighlightsSection } from '@/components/home/highlights-section';
import { TokenTable } from '@/components/home/token-table';
import { useHomeTokens } from '@/components/home/home-tokens-provider';
import { createMemecoinHighlights } from '@/lib/home-highlights';
import {
    DEFAULT_MEMECOIN_TRENDING_DURATION,
    MEMECOIN_TRENDING_DURATIONS,
    type MemecoinTrendingDuration,
} from '@/lib/memecoin-trending';
import type { Token } from '@/lib/types';
import { cn } from '@tokens/ui/cn';
import { Skeleton } from '@tokens/ui/skeleton';

interface MemecoinListPageResponse {
    tokens?: Token[];
    page?: number;
    hasMore?: boolean;
    duration?: MemecoinTrendingDuration;
}

export function MemecoinsTableBridge() {
    const { tokens: seededTokens, isLoading, error } = useHomeTokens();
    const [duration, setDuration] = useState<MemecoinTrendingDuration>(DEFAULT_MEMECOIN_TRENDING_DURATION);
    const [tokens, setTokens] = useState<Token[]>(seededTokens);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [switchingDuration, setSwitchingDuration] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        // Keep SSR / react-query seed until the user changes timeframe.
        if (duration === DEFAULT_MEMECOIN_TRENDING_DURATION && page === 1) {
            setTokens(seededTokens);
        }
    }, [duration, page, seededTokens]);

    const highlights = useMemo(() => createMemecoinHighlights(tokens, duration), [duration, tokens]);

    const fetchPage = useCallback(async (nextPage: number, nextDuration: MemecoinTrendingDuration) => {
        const res = await fetch(
            `/api/memecoins?page=${nextPage}&limit=10&duration=${encodeURIComponent(nextDuration)}`,
            { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`Failed to load memecoins (${res.status})`);
        return (await res.json()) as MemecoinListPageResponse;
    }, []);

    const handleDurationChange = useCallback(
        async (next: MemecoinTrendingDuration) => {
            if (next === duration || switchingDuration) return;
            setSwitchingDuration(true);
            setLoadError(null);
            try {
                const data = await fetchPage(1, next);
                setDuration(next);
                setTokens(data.tokens ?? []);
                setPage(1);
                setHasMore(Boolean(data.hasMore) && (data.tokens?.length ?? 0) > 0);
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : 'Failed to switch timeframe');
            } finally {
                setSwitchingDuration(false);
            }
        },
        [duration, fetchPage, switchingDuration],
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        setLoadError(null);
        try {
            const nextPage = page + 1;
            const data = await fetchPage(nextPage, duration);
            const nextTokens = data.tokens ?? [];
            setTokens(current => {
                const seen = new Set(current.map(token => token.address));
                const merged = [...current];
                for (const token of nextTokens) {
                    if (seen.has(token.address)) continue;
                    seen.add(token.address);
                    merged.push(token);
                }
                return merged;
            });
            setPage(nextPage);
            setHasMore(Boolean(data.hasMore) && nextTokens.length > 0);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load more');
        } finally {
            setLoadingMore(false);
        }
    }, [duration, fetchPage, hasMore, loadingMore, page]);

    const header = (
        <div className="mx-auto max-w-7xl px-6 mb-4 md:mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="text-balance text-[22px] md:text-[26px] leading-[1.15] font-medium text-text-extra-high">
                    Memecoins
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-text-medium">Trending on Solana</p>
            </div>
            <div className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full border border-border-medium bg-white p-1">
                {MEMECOIN_TRENDING_DURATIONS.map(option => {
                    const active = option === duration;
                    return (
                        <button
                            key={option}
                            type="button"
                            disabled={switchingDuration}
                            onClick={() => void handleDurationChange(option)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                                active
                                    ? 'bg-gray-900 text-white'
                                    : 'text-text-medium hover:bg-gray-50 hover:text-text-high',
                                switchingDuration && 'opacity-60',
                            )}
                        >
                            {option.toUpperCase()}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    if (error) {
        return (
            <div>
                {header}
                <section className="mx-auto max-w-7xl px-4 md:px-6 pb-12 md:pb-20">
                    <div className="bg-white rounded-[24px] md:rounded-[32px] border border-border-light shadow-[0_8px_40px_rgba(0,0,0,0.03)] p-6 md:p-12 text-center">
                        <p className="text-text-low text-[14px] md:text-[16px]">Failed to load memecoins</p>
                        <p className="text-text-extra-low text-[12px] md:text-[14px] mt-2">
                            {error instanceof Error ? error.message : 'Try again in a moment.'}
                        </p>
                    </div>
                </section>
            </div>
        );
    }

    if (isLoading && tokens.length === 0) {
        return (
            <div>
                {header}
                <section className="mx-auto max-w-7xl px-4 md:px-6 pb-12 md:pb-20">
                    <div className="bg-white rounded-[24px] md:rounded-[32px] border border-border-medium p-8">
                        <Skeleton className="h-40 w-full bg-gray-100" />
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div>
            {header}

            <HighlightsSection cards={highlights} chartDuration={duration} />

            <TokenTable tokens={tokens} categoryId="memecoins" flushBottom />

            {hasMore ? (
                <div className="mx-auto max-w-7xl px-4 md:px-6 mt-4 mb-12 md:mb-20 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void loadMore()}
                        disabled={loadingMore || switchingDuration}
                        className="rounded-full border border-border-medium bg-white px-5 py-2.5 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                        {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                    {loadError ? <p className="text-[13px] text-text-low">{loadError}</p> : null}
                </div>
            ) : loadError ? (
                <p className="mx-auto max-w-7xl px-4 md:px-6 mt-4 mb-12 text-center text-[13px] text-text-low">
                    {loadError}
                </p>
            ) : (
                <div className="mb-12 md:mb-20" />
            )}
        </div>
    );
}
