import { Suspense } from 'react';

import { CategoryTabs } from '@/components/home/category-tabs';
import { HOME_MARKET_CATEGORIES } from '@/components/home/home-categories';
import { HomeHighlightsBridge } from '@/components/home/home-highlights-bridge';
import { HomeTokensProvider } from '@/components/home/home-tokens-provider';
import { fetchTrendingSolanaMemecoins } from '@/lib/dexscreener-memecoins';
import { DEFAULT_MEMECOIN_TRENDING_DURATION } from '@/lib/memecoin-trending';
import { Skeleton } from '@tokens/ui/skeleton';

function MarketTableSkeleton() {
    return (
        <section className="mx-auto max-w-7xl px-4 md:px-6 pb-12 md:pb-20">
            <div className="bg-white rounded-[24px] md:rounded-[32px] border border-border-medium shadow-[0_8px_40px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-extra-light bg-gray-50/80">
                                {Array.from({ length: 6 }, (_, index) => (
                                    <th
                                        key={index}
                                        className={`py-3 bg-gray-50/80 border-b border-border-light ${
                                            index === 0
                                                ? 'pl-4 md:pl-8 pr-4'
                                                : index === 5
                                                  ? 'pl-6 pr-4 md:pr-8 text-right'
                                                  : 'px-3 md:px-6'
                                        }`}
                                    >
                                        <Skeleton className="h-4 w-16 md:w-20 bg-gray-100 rounded" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-extra-light">
                            {Array.from({ length: 8 }, (_, rowIndex) => (
                                <tr key={rowIndex}>
                                    <td className="py-4 pl-4 md:pl-8 pr-4">
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <Skeleton className="h-8 w-8 rounded-full bg-gray-100" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-24 md:w-40 bg-gray-100" />
                                                <Skeleton className="h-3 w-16 md:w-20 bg-gray-100" />
                                            </div>
                                        </div>
                                    </td>
                                    {Array.from({ length: 5 }, (_, colIndex) => (
                                        <td
                                            key={colIndex}
                                            className={
                                                colIndex === 4 ? 'py-4 pl-6 pr-4 md:pr-8' : 'py-4 px-3 md:px-6'
                                            }
                                        >
                                            <Skeleton className="h-4 w-16 md:w-24 bg-gray-100 ml-auto" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

async function MarketTable() {
    const initialTokens = await fetchTrendingSolanaMemecoins(10, DEFAULT_MEMECOIN_TRENDING_DURATION);

    return (
        <HomeTokensProvider
            categories={HOME_MARKET_CATEGORIES}
            initialCategoryId="memecoins"
            initialTokens={initialTokens}
        >
            <HomeHighlightsBridge />
            <CategoryTabs />
        </HomeTokensProvider>
    );
}

export function MemecoinsHomeSection() {
    return (
        <section className="border-t border-gray-1400/10 pt-24 md:pt-28">
            {/*
              Anchor sits below the border + padding so Explore scrolls past the divider line.
              scroll-mt clears the fixed header; padding above the anchor must exceed scroll-mt.
            */}
            <div id="memecoins" className="scroll-mt-20 md:scroll-mt-24" aria-hidden="true" />
            <Suspense fallback={<MarketTableSkeleton />}>
                <MarketTable />
            </Suspense>
        </section>
    );
}
