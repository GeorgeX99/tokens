'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BarChart3, Clock, Search } from 'lucide-react';
import { trackEvent } from '@/lib/posthog-client';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@tokens/ui/command';
import { Skeleton } from '@tokens/ui/skeleton';
import { useLocalStorage, useMediaQuery } from '@tokens/ui/hooks';
import { useCuratedTokens, useMemecoinTokens, useSearchTokens } from '@/hooks/queries/use-token-search';
import { cleanTokenName } from '@/lib/logo-overrides';
import { formatLargeNumber, formatPrice } from '@/lib/format';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';
import { SITE_LOGO_SRC, SITE_TICKER, SITE_TOKEN_NAME, getSplMint } from '@/lib/site-brand';
import type { Token } from '@/lib/types';

interface RecentSolanaTokenEntry {
    token: Token;
    selectedAt: number;
}

function buildSplHomeToken(): Token {
    const mint = getSplMint();
    return {
        address: mint && looksLikeSolanaMintAddress(mint) ? mint : 'spl',
        symbol: SITE_TICKER,
        name: SITE_TOKEN_NAME,
        decimals: 0,
        logoURI: SITE_LOGO_SRC,
        price: 0,
        priceChange24hPercent: 0,
        priceChange1hPercent: 0,
        volume24hUSD: 0,
        liquidity: 0,
        marketCap: 0,
        category: 'memecoin',
        assetId: 'spl-token',
    };
}

function tokenMatchesQuery(token: Token, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const cleanedName = cleanTokenName(token.name).toLowerCase();

    return (
        (token.assetId ?? '').toLowerCase().includes(q) ||
        (token.coingeckoId ?? '').toLowerCase().includes(q) ||
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        cleanedName.includes(q) ||
        token.address.toLowerCase().includes(q)
    );
}

function tokenCommandValue(token: Token): string {
    const tokenDisplayName = cleanTokenName(token.name);
    return [token.symbol, token.name, tokenDisplayName, token.address, token.assetId, token.coingeckoId]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ');
}

function TokenLogo({ token }: { token: Token }) {
    const [hasError, setHasError] = React.useState(false);
    const isBrandLogo = token.logoURI === SITE_LOGO_SRC || token.assetId === 'spl-token';

    if (!token.logoURI || hasError) {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-text-medium">
                {(token.symbol || token.name || '??').slice(0, 2).toUpperCase()}
            </div>
        );
    }

    return (
        <Image
            src={token.logoURI}
            alt={token.symbol}
            className={
                isBrandLogo
                    ? 'h-8 w-8 bg-transparent object-contain'
                    : 'h-8 w-8 rounded-full bg-gray-50 object-cover'
            }
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
        />
    );
}

function CommandGroupHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className="flex items-center gap-1.5">
            <span className="shrink-0">{icon}</span>
            <span>{children}</span>
        </span>
    );
}

function Keycap({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="inline-flex h-4 select-none items-center justify-center rounded border border-border-light bg-gray-50 px-2 font-sans text-[11px] font-medium text-text-medium">
            {children}
        </kbd>
    );
}

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                {keys.map(key => (
                    <Keycap key={key}>{key}</Keycap>
                ))}
            </div>
            <span className="text-xs text-text-high">{label}</span>
        </div>
    );
}

function TokenSearchItemSkeleton({ index }: { index: number }) {
    return (
        <CommandItem disabled value={`__loading__${index}`} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-10 rounded" />
                    <Skeleton className="h-4 w-40 rounded" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-20 rounded" />
                </div>
            </div>
            <Skeleton className="h-3 w-10 rounded" />
        </CommandItem>
    );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = React.useState(value);

    React.useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(timer);
    }, [delayMs, value]);

    return debounced;
}

function useTokenSearchData(open: boolean, query: string) {
    const trimmedQuery = query.trim();
    const hasQuery = trimmedQuery.length > 0;
    const debouncedQuery = useDebouncedValue(trimmedQuery, 250);
    const [recentTokens, setRecentTokens] = useLocalStorage<RecentSolanaTokenEntry[]>('token-search:recent', []);
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const {
        data: majorsTokens = [],
        isLoading: isLoadingTopTokens,
        error: topTokensError,
    } = useCuratedTokens('majors', { enabled: open });
    const {
        data: memecoinTokens = [],
        isLoading: isLoadingMemecoins,
        error: memecoinsError,
    } = useMemecoinTokens({ enabled: open });

    const solanaToken = React.useMemo(
        () => majorsTokens.find(token => (token.assetId ?? '').trim() === 'solana') ?? null,
        [majorsTokens],
    );

    const topTokensSource = React.useMemo(() => {
        const rows: Token[] = [buildSplHomeToken()];
        if (solanaToken) rows.push(solanaToken);
        for (const token of memecoinTokens.slice(0, 40)) rows.push(token);
        return rows;
    }, [memecoinTokens, solanaToken]);

    // Recent searches are stored as full Token snapshots in localStorage, so their
    // market data goes stale. Overlay fresh values from already-fetched queries so the
    // palette matches prices shown elsewhere in the app.
    const freshTokensByAddress = React.useMemo(() => {
        const map = new Map<string, Token>();
        for (const token of topTokensSource) map.set(token.address, token);
        return map;
    }, [topTokensSource]);

    const recentSearches = React.useMemo(() => {
        const filtered = recentTokens
            .filter(item => tokenMatchesQuery(item.token, query))
            .sort((a, b) => b.selectedAt - a.selectedAt);

        const seen = new Set<string>();
        const unique: RecentSolanaTokenEntry[] = [];

        for (const item of filtered) {
            const address = item.token.address;
            if (seen.has(address)) continue;
            seen.add(address);
            const fresh = freshTokensByAddress.get(address);
            unique.push(fresh ? { ...item, token: fresh } : item);
            if (unique.length >= 8) break;
        }

        return unique;
    }, [freshTokensByAddress, query, recentTokens]);

    const topTokens = React.useMemo(() => {
        const filtered = topTokensSource.filter(token => tokenMatchesQuery(token, query));
        if (!isDesktop) return filtered.slice(0, 50);

        const recentAddresses = new Set(recentTokens.map(entry => entry.token.address));
        return filtered.filter(token => !recentAddresses.has(token.address)).slice(0, 50);
    }, [isDesktop, query, recentTokens, topTokensSource]);

    const isInitialLoadingTopTokens =
        open && !hasQuery && (isLoadingTopTokens || isLoadingMemecoins) && topTokensSource.length <= 1;

    const searchTokens = React.useMemo(() => {
        if (!hasQuery) return [];

        const seen = new Set<string>();
        const matches: Token[] = [];

        for (const token of topTokensSource) {
            if (!tokenMatchesQuery(token, query)) continue;
            const key = (token.assetId ?? '').trim() || token.address;
            if (seen.has(key)) continue;
            seen.add(key);
            matches.push(token);
            if (matches.length >= 50) break;
        }

        return matches;
    }, [hasQuery, query, topTokensSource]);

    const isMintQuery = looksLikeSolanaMintAddress(trimmedQuery);
    const remoteQuery = isMintQuery ? trimmedQuery : debouncedQuery;
    const remoteIsMint = looksLikeSolanaMintAddress(remoteQuery);
    const shouldRemoteSearch =
        open && remoteQuery.length > 0 && (remoteIsMint || remoteQuery.length >= 2);

    const {
        data: serverSearchTokens = [],
        isLoading: isLoadingServerSearch,
        isFetching: isFetchingServerSearch,
        error: serverSearchError,
    } = useSearchTokens(remoteQuery, {
        enabled: shouldRemoteSearch,
    });

    const mergedSearchTokens = React.useMemo(() => {
        if (!hasQuery) return [];

        const seen = new Set<string>();
        const matches: Token[] = [];

        const remember = (token: Token) => {
            const assetKey = (token.assetId ?? '').trim();
            const addressKey = token.address.trim();
            if (assetKey && seen.has(assetKey)) return false;
            if (addressKey && seen.has(addressKey)) return false;
            if (assetKey) seen.add(assetKey);
            if (addressKey) seen.add(addressKey);
            matches.push(token);
            return true;
        };

        for (const token of searchTokens) {
            remember(token);
            if (matches.length >= 50) break;
        }

        for (const token of serverSearchTokens) {
            remember(token);
            if (matches.length >= 50) break;
        }

        return matches;
    }, [hasQuery, searchTokens, serverSearchTokens]);

    const hasSearchError =
        hasQuery &&
        mergedSearchTokens.length === 0 &&
        Boolean(serverSearchError || memecoinsError) &&
        !isLoadingServerSearch &&
        !isFetchingServerSearch &&
        !isLoadingMemecoins;
    const isInitialLoadingSearch =
        hasQuery &&
        mergedSearchTokens.length === 0 &&
        (isLoadingMemecoins ||
            isLoadingTopTokens ||
            ((isMintQuery || debouncedQuery === trimmedQuery) &&
                (isLoadingServerSearch || isFetchingServerSearch)));

    return {
        recentSearches,
        topTokens,
        searchTokens: mergedSearchTokens,
        topTokensError: topTokensError ?? memecoinsError,
        hasSearchError,
        isInitialLoadingTopTokens,
        isInitialLoadingSearch,
        setRecentTokens,
    };
}

function TokenCommandRow({ token, onSelect }: { token: Token; onSelect: (token: Token) => Promise<void> }) {
    const tokenDisplayName = cleanTokenName(token.name);

    return (
        <CommandItem
            value={tokenCommandValue(token)}
            onSelect={() => void onSelect(token)}
            className="flex items-center gap-3 px-3 py-2 rounded-2xl"
        >
            <TokenLogo token={token} />
            <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-text-extra-high">{tokenDisplayName}</span>
                    <span className="text-sm text-text-low truncate max-w-[180px]">{token.symbol}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-extra-low">
                    <span>{formatPrice(token.price)}</span>
                    {token.volume24hUSD > 0 && <span>Vol: {formatLargeNumber(token.volume24hUSD)}</span>}
                </div>
            </div>
            {token.priceChange24hPercent !== 0 && (
                <span
                    className={`text-xs font-medium ${
                        token.priceChange24hPercent > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                    {token.priceChange24hPercent > 0 ? '+' : ''}
                    {token.priceChange24hPercent.toFixed(2)}%
                </span>
            )}
        </CommandItem>
    );
}

interface TokenSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TokenSearchDialog({ open, onOpenChange }: TokenSearchDialogProps) {
    const router = useRouter();
    const [query, setQuery] = React.useState('');
    const hasQuery = query.trim().length > 0;

    const {
        recentSearches,
        topTokens,
        searchTokens,
        topTokensError,
        hasSearchError,
        isInitialLoadingTopTokens,
        isInitialLoadingSearch,
        setRecentTokens,
    } = useTokenSearchData(open, query);

    async function handleSelectToken(token: Token): Promise<void> {
        const apiAssetId = token.assetId?.trim() || null;

        setRecentTokens(prev => {
            const next: RecentSolanaTokenEntry[] = [
                { token, selectedAt: Date.now() },
                ...prev.filter(entry => entry.token.address !== token.address),
            ];
            return next.slice(0, 8);
        });

        trackEvent('search_token_selected', {
            token_address: token.address,
            token_symbol: token.symbol,
            token_name: token.name,
            ...(apiAssetId ? { asset_id: apiAssetId } : {}),
            search_query: query,
            source: hasQuery ? 'cmdk_search' : 'cmdk_suggested',
        });

        onOpenChange(false);
        setQuery('');

        if (apiAssetId === 'spl-token' || token.address === 'spl') {
            router.push('/spl');
            return;
        }
        // Brand mint always uses the dedicated $SPL token page, not the generic CA route.
        const splMint = getSplMint();
        if (splMint && token.address === splMint) {
            router.push('/spl');
            return;
        }
        if (apiAssetId === 'solana') {
            router.push('/solana');
            return;
        }
        if (token.category === 'memecoin' || looksLikeSolanaMintAddress(token.address)) {
            router.push(`/memecoin/${encodeURIComponent(token.address)}`);
            return;
        }
        router.push(`/${encodeURIComponent(apiAssetId ?? token.address)}`);
    }

    function handleOpenChange(nextOpen: boolean) {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery('');
    }

    return (
        <CommandDialog open={open} onOpenChange={handleOpenChange}>
            <CommandInput
                placeholder="Search by name, ticker, or paste a CA..."
                value={query}
                onValueChange={setQuery}
            />

            <CommandList className="h-[400px] max-h-[400px]">
                {(() => {
                    const blocks: React.ReactNode[] = [];

                    if (!hasQuery && recentSearches.length > 0) {
                        blocks.push(
                            <CommandGroup
                                key="recent-searches"
                                heading={
                                    <CommandGroupHeading icon={<Clock className="size-3" />}>
                                        Recent searches
                                    </CommandGroupHeading>
                                }
                            >
                                {recentSearches.map(entry => (
                                    <TokenCommandRow
                                        key={entry.token.address}
                                        token={entry.token}
                                        onSelect={handleSelectToken}
                                    />
                                ))}
                            </CommandGroup>,
                        );
                    }

                    if (hasQuery) {
                        const tokenGroupHeading = (
                            <CommandGroupHeading icon={<Search className="size-3" />}>
                                Search results
                            </CommandGroupHeading>
                        );

                        if (hasSearchError) {
                            blocks.push(
                                <CommandGroup key="curated-search-error" heading={tokenGroupHeading}>
                                    <CommandItem
                                        disabled
                                        value="__curated_search_error__"
                                        className="px-3 py-2 text-text-low"
                                    >
                                        Failed to load search results.
                                    </CommandItem>
                                </CommandGroup>,
                            );
                        } else if (isInitialLoadingSearch) {
                            blocks.push(
                                <CommandGroup key="curated-search-loading" heading={tokenGroupHeading}>
                                    {Array.from({ length: 6 }, (_, index) => (
                                        <TokenSearchItemSkeleton key={index} index={index} />
                                    ))}
                                </CommandGroup>,
                            );
                        } else if (searchTokens.length > 0) {
                            blocks.push(
                                <CommandGroup key="curated-search-results" heading={tokenGroupHeading}>
                                    {searchTokens.map(token => (
                                        <TokenCommandRow key={token.address} token={token} onSelect={handleSelectToken} />
                                    ))}
                                </CommandGroup>,
                            );
                        }
                    }

                    if (!hasQuery) {
                        const tokenGroupHeading = (
                            <CommandGroupHeading icon={<BarChart3 className="size-3" />}>
                                Still trending
                            </CommandGroupHeading>
                        );

                        if (topTokensError) {
                            blocks.push(
                                <CommandGroup key="tokens-error" heading={tokenGroupHeading}>
                                    <CommandItem disabled value="__tokens_error__" className="px-3 py-2 text-text-low">
                                        Failed to load tokens.
                                    </CommandItem>
                                </CommandGroup>,
                            );
                        } else if (isInitialLoadingTopTokens) {
                            blocks.push(
                                <CommandGroup key="tokens-loading" heading={tokenGroupHeading}>
                                    {Array.from({ length: 6 }, (_, index) => (
                                        <TokenSearchItemSkeleton key={index} index={index} />
                                    ))}
                                </CommandGroup>,
                            );
                        } else if (topTokens.length > 0) {
                            blocks.push(
                                <CommandGroup key="top-tokens" heading={tokenGroupHeading}>
                                    {topTokens.map(token => (
                                        <TokenCommandRow key={token.address} token={token} onSelect={handleSelectToken} />
                                    ))}
                                </CommandGroup>,
                            );
                        }
                    }

                    if (blocks.length === 0) {
                        if (hasQuery) return <CommandEmpty>No results found.</CommandEmpty>;
                        return <CommandEmpty>Start typing to search.</CommandEmpty>;
                    }

                    return blocks;
                })()}
            </CommandList>

            <div className="hidden md:flex w-full justify-center items-center border-t border-border-light px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <ShortcutHint keys={['↑', '↓']} label="List" />
                    <ShortcutHint keys={['Enter']} label="Select" />
                    <ShortcutHint keys={['Esc']} label="Close" />
                </div>
            </div>
        </CommandDialog>
    );
}
