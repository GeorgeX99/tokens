import { CURATED_TOKEN_LISTS } from '@tokens/asset-registry/compat';

import { CURATED_LIST_ORDER_WITHOUT_LSTS } from '@/lib/curated-token-lists';
import type { HomeCategoryTab } from '@/components/home/home-tokens-provider';

/** Home market tabs: Memecoins first (default), then curated lists, then Trending. */
export const HOME_MARKET_CATEGORIES: HomeCategoryTab[] = [
    { id: 'memecoins', name: 'Memecoins' },
    ...CURATED_LIST_ORDER_WITHOUT_LSTS.map(id => ({
        id,
        name: CURATED_TOKEN_LISTS[id].name,
    })),
    { id: 'trending', name: 'Trending' },
];
