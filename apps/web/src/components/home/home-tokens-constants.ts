import type { TrendingMode } from '@/hooks/queries/use-token-search';
import { CURATED_LIST_ORDER_WITHOUT_LSTS } from '@/lib/curated-token-lists';
import type { HomeTabId } from '@/lib/home-highlights';
import {
    DEFAULT_MEMECOIN_TRENDING_DURATION,
    MEMECOIN_TRENDING_DURATIONS,
    type MemecoinTrendingDuration,
} from '@/lib/memecoin-trending';
import type { TrendingWindow } from '@/lib/types';

export const HOME_TAB_IDS: HomeTabId[] = ['memecoins', ...CURATED_LIST_ORDER_WITHOUT_LSTS, 'trending'];
export const TRENDING_MODE_IDS: TrendingMode[] = ['fresh', 'flow'];
export const TRENDING_WINDOW_IDS: TrendingWindow[] = ['5m', '15m', '1h', '6h'];
export const MEMECOIN_DURATION_IDS: MemecoinTrendingDuration[] = [...MEMECOIN_TRENDING_DURATIONS];
export { DEFAULT_MEMECOIN_TRENDING_DURATION };
