'use client';

import { useMemo } from 'react';

import { HighlightsSection } from '@/components/home/highlights-section';
import { useHomeTokens } from '@/components/home/home-tokens-provider';
import { createHomeHighlights, createMemecoinHighlights } from '@/lib/home-highlights';

export function HomeHighlightsBridge() {
    const { tokens, activeCategoryId, memecoinDuration } = useHomeTokens();

    const cards = useMemo(() => {
        if (activeCategoryId === 'memecoins') {
            return createMemecoinHighlights(tokens, memecoinDuration);
        }
        return createHomeHighlights(tokens, null);
    }, [activeCategoryId, memecoinDuration, tokens]);

    return (
        <HighlightsSection
            cards={cards}
            chartDuration={activeCategoryId === 'memecoins' ? memecoinDuration : undefined}
        />
    );
}
