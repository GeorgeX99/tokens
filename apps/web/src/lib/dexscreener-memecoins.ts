import 'server-only';

import { connection } from 'next/server';
import { getVariantByMint, resolveAlias } from '@tokens/asset-registry';
import {
    DEFAULT_MEMECOIN_TRENDING_DURATION,
    type MemecoinTrendingDuration,
    volumeForDuration,
} from '@/lib/memecoin-trending';
import {
    isRugFromMarketSignals,
    shouldDropMemecoinAsRug,
    type RugcheckTokenInfoReport,
} from '@/lib/memecoin-scam-filter';
import type { Token } from '@/lib/types';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

export {
    DEFAULT_MEMECOIN_TRENDING_DURATION,
    isMemecoinTrendingDuration,
    MEMECOIN_TRENDING_DURATIONS,
    type MemecoinTrendingDuration,
    changeForDuration,
    volumeForDuration,
} from '@/lib/memecoin-trending';

// Live Solana memecoin discovery: GeckoTerminal trending pools (fallback: Pump.fun),
// enriched with DexScreener pair metrics. Nothing here is pre-baked into the codebase.

const GECKOTERMINAL_ORIGIN = 'https://api.geckoterminal.com';
const PUMP_FRONTEND_ORIGIN = 'https://frontend-api-v3.pump.fun';
const DEXSCREENER_ORIGIN = 'https://api.dexscreener.com';
const SOLANA_CHAIN_ID = 'solana';
const FETCH_TIMEOUT_MS = 6_000;
const RUGCHECK_TIMEOUT_MS = 10_000;
const WEBACY_TIMEOUT_MS = 8_000;
const TOKEN_INFO_CONCURRENCY = 4;
const MAX_BATCH_SIZE = 30;
const DISCOVERY_REVALIDATE_SECONDS = 30;
const WEBACY_ORIGIN = 'https://api.webacy.com';

const MIN_LIQUIDITY_USD = 5_000;
const MIN_VOLUME_24H_USD = 1_000;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_RESULT_LIMIT = 10;
/** Always discover at least this many mint candidates (display page size can be smaller). */
const MIN_DISCOVERY_CANDIDATES = 40;
/** Over-fetch before rug drops so the page still fills. */
const RUG_FILTER_OVERFETCH = 40;

// Filters out phishing bait / corporate-impersonation style names that otherwise pass
// the liquidity and volume checks.
const SUSPICIOUS_TEXT_PATTERN = /(airdrop|claim\s*now|https?:\/\/|\.(com|io|xyz|net)\b|migrat(e|ion))/i;

interface DexscreenerTokenRef {
    address?: string;
    name?: string;
    symbol?: string;
}

interface DexscreenerPair {
    chainId?: string;
    dexId?: string;
    url?: string;
    pairAddress?: string;
    baseToken?: DexscreenerTokenRef;
    priceUsd?: string;
    priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
    volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
    txns?: {
        m5?: { buys?: number; sells?: number };
        h1?: { buys?: number; sells?: number };
        h6?: { buys?: number; sells?: number };
        h24?: { buys?: number; sells?: number };
    };
    liquidity?: { usd?: number };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
    info?: { imageUrl?: string };
}

interface GeckoTrendingPool {
    attributes?: {
        name?: string;
        address?: string;
        reserve_in_usd?: string;
        volume_usd?: { h24?: string; h1?: string };
        market_cap_usd?: string | null;
        fdv_usd?: string | null;
        base_token_price_usd?: string;
        price_change_percentage?: { h24?: string; h1?: string };
        pool_created_at?: string;
    };
    relationships?: {
        base_token?: { data?: { id?: string; type?: string } };
    };
}

interface PumpCoinListItem {
    mint?: string;
    name?: string;
    symbol?: string;
    image_uri?: string;
    usd_market_cap?: number;
    market_cap?: number;
    complete?: boolean;
}

export interface MemecoinListPage {
    tokens: Token[];
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface MemecoinDetail {
    address: string;
    name: string;
    symbol: string;
    logoURI?: string;
    price: number;
    priceChange1hPercent?: number;
    priceChange24hPercent: number;
    liquidityUsd: number;
    volume1hUsd: number | null;
    volume24hUsd: number;
    marketCap: number;
    fdv: number | null;
    /** Human units (not raw lamports/atoms). */
    totalSupply: number | null;
    circulatingSupply: number | null;
    holders: number | null;
    /** Buys + sells in the last hour from DexScreener. */
    trade1h: number | null;
    /** Buys + sells in the last 24h from DexScreener. */
    trade24h: number | null;
    pairCreatedAt: number | null;
    dexId: string;
    pairAddress: string;
    dexScreenerUrl: string;
}

async function fetchDexscreenerJson<T>(
    url: string,
    timeoutMs = FETCH_TIMEOUT_MS,
    options?: { cache?: RequestCache },
): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: {
                accept: 'application/json',
                'user-agent': 'Mozilla/5.0 (compatible; SPLTokenMemecoins/1.0)',
            },
            ...(options?.cache === 'no-store'
                ? { cache: 'no-store' as const }
                : { next: { revalidate: DISCOVERY_REVALIDATE_SECONDS } }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

/** Rugcheck must not cache misses/429s — that previously fail-opened rugs onto the board. */
async function fetchRugcheckReport(mint: string): Promise<RugcheckReport | null> {
    const url = `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report`;
    const first = await fetchDexscreenerJson<RugcheckReport>(url, RUGCHECK_TIMEOUT_MS, { cache: 'no-store' });
    if (first) return first;
    return fetchDexscreenerJson<RugcheckReport>(url, RUGCHECK_TIMEOUT_MS, { cache: 'no-store' });
}

async function mapPool<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await worker(items[index]!);
        }
    });
    await Promise.all(runners);
    return results;
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

function mintFromGeckoTokenId(id: string | undefined): string | null {
    if (!id) return null;
    const mint = id.replace(/^solana_/i, '').trim();
    return mint.length > 0 ? mint : null;
}

/** Real trending (not paid boosts): GeckoTerminal Solana trending pools. */
async function discoverTrendingMintsFromGecko(
    page: number,
    duration: MemecoinTrendingDuration,
): Promise<{ mints: string[]; rawCount: number }> {
    const url =
        `${GECKOTERMINAL_ORIGIN}/api/v2/networks/solana/trending_pools` +
        `?page=${page}&duration=${encodeURIComponent(duration)}`;
    const body = await fetchDexscreenerJson<{ data?: GeckoTrendingPool[] }>(url);
    const pools = body?.data;
    if (!Array.isArray(pools) || pools.length === 0) return { mints: [], rawCount: 0 };

    const seen = new Set<string>();
    const mints: string[] = [];
    for (const pool of pools) {
        const mint = mintFromGeckoTokenId(pool.relationships?.base_token?.data?.id);
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);
        mints.push(mint);
    }
    return { mints, rawCount: pools.length };
}

/** Fallback: recently traded Pump.fun coins (paginated by offset). */
async function discoverMintsFromPump(page: number, pageSize: number): Promise<{ mints: string[]; rawCount: number }> {
    const offset = Math.max(0, (page - 1) * pageSize);
    const url =
        `${PUMP_FRONTEND_ORIGIN}/coins?sort=last_trade_timestamp&order=DESC` +
        `&limit=${pageSize}&offset=${offset}&includeNsfw=false`;
    const body = await fetchDexscreenerJson<PumpCoinListItem[]>(url);
    if (!Array.isArray(body) || body.length === 0) return { mints: [], rawCount: 0 };

    const seen = new Set<string>();
    const mints: string[] = [];
    for (const coin of body) {
        const mint = coin.mint?.trim();
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);
        mints.push(mint);
    }
    return { mints, rawCount: body.length };
}

async function fetchPairsForAddresses(addresses: string[]): Promise<DexscreenerPair[]> {
    const batches = chunk(addresses, MAX_BATCH_SIZE);
    const results = await Promise.all(
        batches.map(batch =>
            fetchDexscreenerJson<DexscreenerPair[]>(
                `${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${batch.join(',')}`,
            ),
        ),
    );
    return results.flatMap(pairs => pairs ?? []);
}

/** Highest-liquidity Solana pair per base-token address (a token can trade on several pools). */
function pickBestPairPerToken(pairs: DexscreenerPair[]): Map<string, DexscreenerPair> {
    const best = new Map<string, DexscreenerPair>();
    for (const pair of pairs) {
        if (pair.chainId !== SOLANA_CHAIN_ID) continue;
        const address = pair.baseToken?.address?.trim();
        if (!address) continue;
        const liquidity = pair.liquidity?.usd ?? 0;
        const existing = best.get(address);
        if (!existing || liquidity > (existing.liquidity?.usd ?? 0)) best.set(address, pair);
    }
    return best;
}

/** True if this mint is already listed elsewhere on the platform, or impersonates one that is. */
function collidesWithExistingListing(mint: string, name: string, symbol: string): boolean {
    if (getVariantByMint(mint)) return true;

    const aliasMatch = resolveAlias(symbol) ?? resolveAlias(name);
    if (aliasMatch && !aliasMatch.variants.some(variant => variant.mint === mint)) return true;

    return false;
}

function looksSuspicious(name: string, symbol: string): boolean {
    return SUSPICIOUS_TEXT_PATTERN.test(name) || SUSPICIOUS_TEXT_PATTERN.test(symbol);
}

function pairAgeHours(pair: DexscreenerPair, nowMs = Date.now()): number | null {
    const created = pair.pairCreatedAt;
    if (typeof created !== 'number' || !Number.isFinite(created) || created <= 0) return null;
    return Math.max(0, (nowMs - created) / 3_600_000);
}

function passesQualityFilters(pair: DexscreenerPair): boolean {
    const address = pair.baseToken?.address?.trim();
    const name = pair.baseToken?.name?.trim();
    const symbol = pair.baseToken?.symbol?.trim();
    if (!address || !name || !symbol) return false;
    // Never list the site’s own featured mint in the memecoin board.
    const brandMint = process.env.NEXT_PUBLIC_SPL_MINT?.trim();
    if (brandMint && address === brandMint) return false;
    const liquidity = pair.liquidity?.usd ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    if (liquidity < MIN_LIQUIDITY_USD) return false;
    if (volume24h < MIN_VOLUME_24H_USD) return false;
    if (looksSuspicious(name, symbol)) return false;
    if (collidesWithExistingListing(address, name, symbol)) return false;
    // Wash dumps / cartoon pumps — no Token Info needed.
    if (
        isRugFromMarketSignals({
            liquidityUsd: liquidity,
            volume24hUsd: volume24h,
            priceChange24hPercent: pair.priceChange?.h24 ?? 0,
            pairAgeHours: pairAgeHours(pair),
        })
    ) {
        return false;
    }
    return true;
}

function pairToToken(pair: DexscreenerPair, nowMs: number): Token {
    const address = pair.baseToken!.address!.trim();
    const name = pair.baseToken!.name!.trim();
    const symbol = pair.baseToken!.symbol!.trim();
    const trade5m = txnCount(pair.txns?.m5);
    const trade1h = txnCount(pair.txns?.h1);
    const trade6h = txnCount(pair.txns?.h6);
    const trade24h = txnCount(pair.txns?.h24);

    return {
        category: 'memecoin',
        address,
        name,
        symbol,
        decimals: 9,
        ...(pair.info?.imageUrl ? { logoURI: pair.info.imageUrl } : {}),
        liquidity: pair.liquidity?.usd ?? 0,
        ...(pair.volume?.m5 != null ? { volume5mUSD: pair.volume.m5 } : {}),
        ...(pair.volume?.h1 != null ? { volume1hUSD: pair.volume.h1 } : {}),
        ...(pair.volume?.h6 != null ? { volume6hUSD: pair.volume.h6 } : {}),
        volume24hUSD: pair.volume?.h24 ?? 0,
        ...(trade5m != null ? { trade5m } : {}),
        ...(trade1h != null ? { trade1h } : {}),
        ...(trade6h != null ? { trade6h } : {}),
        ...(trade24h != null ? { trade24h } : {}),
        price: Number.parseFloat(pair.priceUsd ?? '0') || 0,
        priceChange24hPercent: pair.priceChange?.h24 ?? 0,
        ...(pair.priceChange?.h1 != null ? { priceChange1hPercent: pair.priceChange.h1 } : {}),
        ...(pair.priceChange?.m5 != null ? { priceChange5mPercent: pair.priceChange.m5 } : {}),
        ...(pair.priceChange?.h6 != null ? { priceChange6hPercent: pair.priceChange.h6 } : {}),
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        asOf: nowMs,
    } satisfies Token;
}

/** Fill missing DexScreener logos from Pump.fun metadata when available. */
async function enrichMissingMemecoinLogos(tokens: Token[]): Promise<Token[]> {
    const missing = tokens.filter(token => !token.logoURI?.trim());
    if (missing.length === 0) return tokens;

    const entries = await Promise.all(
        missing.map(async token => {
            const meta = await fetchDexscreenerJson<{ image_uri?: string }>(
                `${PUMP_FRONTEND_ORIGIN}/coins/${encodeURIComponent(token.address)}`,
            );
            const image = meta?.image_uri?.trim();
            return image ? ([token.address, image] as const) : null;
        }),
    );

    const byMint = new Map<string, string>();
    for (const entry of entries) {
        if (!entry) continue;
        byMint.set(entry[0], entry[1]);
    }
    if (byMint.size === 0) return tokens;

    return tokens.map(token => {
        if (token.logoURI?.trim()) return token;
        const logoURI = byMint.get(token.address);
        return logoURI ? { ...token, logoURI } : token;
    });
}

/**
 * Live Solana memecoins from GeckoTerminal trending pools (not DexScreener boosts).
 * Falls back to recently traded Pump.fun coins when Gecko is rate-limited.
 * DexScreener is only used to enrich logos / liquidity / volume.
 */
export async function fetchTrendingSolanaMemecoinsPage(options: {
    page?: number;
    pageSize?: number;
    duration?: MemecoinTrendingDuration;
} = {}): Promise<MemecoinListPage & { duration: MemecoinTrendingDuration }> {
    await connection();
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const pageSize = Math.min(50, Math.max(5, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)));
    const duration = options.duration ?? DEFAULT_MEMECOIN_TRENDING_DURATION;
    const nowMs = Date.now();

    let usedGecko = false;
    let discovered =
        page === 1
            ? await discoverTrendingMintsFromGecko(page, duration)
            : await discoverMintsFromPump(page, pageSize);
    if (page === 1 && discovered.mints.length > 0) usedGecko = true;

    // Page 1 prefers Gecko trending; later pages prefer Pump (Gecko free tier rate-limits hard).
    if (discovered.mints.length === 0) {
        discovered =
            page === 1
                ? await discoverMintsFromPump(page, pageSize)
                : await discoverTrendingMintsFromGecko(page, duration);
        usedGecko = page !== 1 && discovered.mints.length > 0;
    }

    if (discovered.mints.length === 0) {
        return { tokens: [], page, pageSize, hasMore: false, duration };
    }

    // Scam filters drop a lot of “trending” trash — keep a mint backlog so the page can refill.
    const mintQueue = [...discovered.mints];
    const seenMints = new Set(mintQueue);
    const discoveryTarget = Math.max(MIN_DISCOVERY_CANDIDATES, pageSize + RUG_FILTER_OVERFETCH);
    // Page 1: pull a fat Pump backlog even when the UI only shows 10 rows.
    if (page === 1) {
        let pumpPage = 1;
        while (mintQueue.length < discoveryTarget && pumpPage <= 3) {
            const pumpFill = await discoverMintsFromPump(pumpPage, MIN_DISCOVERY_CANDIDATES);
            if (pumpFill.mints.length === 0) break;
            for (const mint of pumpFill.mints) {
                if (seenMints.has(mint)) continue;
                seenMints.add(mint);
                mintQueue.push(mint);
            }
            pumpPage += 1;
        }
    }

    const pairs = await fetchPairsForAddresses(mintQueue);
    const bestPerToken = pickBestPairPerToken(pairs);

    let tokens: Token[] = [];
    for (const mint of mintQueue) {
        const pair = bestPerToken.get(mint);
        if (!pair || !passesQualityFilters(pair)) continue;
        tokens.push(pairToToken(pair, nowMs));
    }

    // Keep Gecko order for the first discoveries; append fill candidates by timeframe volume.
    if (!usedGecko) {
        tokens.sort((a, b) => volumeForDuration(b, duration) - volumeForDuration(a, duration));
    } else {
        const geckoRank = new Map(discovered.mints.map((mint, index) => [mint, index]));
        tokens.sort((a, b) => {
            const ai = geckoRank.get(a.address);
            const bi = geckoRank.get(b.address);
            if (ai != null && bi != null) return ai - bi;
            if (ai != null) return -1;
            if (bi != null) return 1;
            return volumeForDuration(b, duration) - volumeForDuration(a, duration);
        });
    }

    // Over-fetch so Token Info / market rug drops can still fill the page.
    tokens = tokens.slice(0, pageSize + RUG_FILTER_OVERFETCH);
    tokens = await filterRugsByTokenInfo(tokens);
    tokens = tokens.slice(0, pageSize);
    tokens = await enrichMissingMemecoinLogos(tokens);

    const hasMore = discovered.rawCount >= Math.min(20, pageSize) || tokens.length >= pageSize;
    return { tokens, page, pageSize, hasMore, duration };
}

/** Convenience: first page for SSR / simple clients. */
export async function fetchTrendingSolanaMemecoins(
    limit = DEFAULT_RESULT_LIMIT,
    duration: MemecoinTrendingDuration = DEFAULT_MEMECOIN_TRENDING_DURATION,
): Promise<Token[]> {
    const page = await fetchTrendingSolanaMemecoinsPage({
        page: 1,
        pageSize: Math.min(50, Math.max(5, limit)),
        duration,
    });
    return page.tokens.slice(0, limit);
}

function txnCount(bucket: { buys?: number; sells?: number } | undefined): number | null {
    if (!bucket) return null;
    const buys = typeof bucket.buys === 'number' && Number.isFinite(bucket.buys) ? bucket.buys : 0;
    const sells = typeof bucket.sells === 'number' && Number.isFinite(bucket.sells) ? bucket.sells : 0;
    const total = buys + sells;
    return total > 0 ? total : null;
}

interface RugcheckReport extends RugcheckTokenInfoReport {
    totalHolders?: number;
    token?: { supply?: number; decimals?: number };
}

interface WebacyTradingLite {
    Top10Holders?: number;
    BundlerPercentageHolding?: number;
    BundlerPercentageOnLaunch?: number;
    SniperPercentageHolding?: number;
    SniperPercentageOnLaunch?: number;
    DevHoldingPercentage?: number;
}

function webacyApiKey(): string | null {
    const key = process.env.WEBACY_API_KEY?.trim() || process.env.DD_API_KEY?.trim();
    return key && key.length > 0 ? key : null;
}

async function fetchWebacyTradingLite(mint: string): Promise<WebacyTradingLite | null> {
    const apiKey = webacyApiKey();
    if (!apiKey) return null;
    try {
        const res = await fetch(`${WEBACY_ORIGIN}/trading-lite/${encodeURIComponent(mint)}?chain=sol`, {
            headers: {
                accept: 'application/json',
                'x-api-key': apiKey,
                'user-agent': 'Mozilla/5.0 (compatible; SPLTokenMemecoins/1.0)',
            },
            next: { revalidate: DISCOVERY_REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(WEBACY_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        return (await res.json()) as WebacyTradingLite;
    } catch {
        return null;
    }
}

/**
 * Drop rugs using Token Info (Top10 / Insiders / Bundlers / Dev / graph insiders)
 * plus Dex market fingerprints. Fail-closed when Token Info APIs miss.
 */
async function filterRugsByTokenInfo(tokens: Token[]): Promise<Token[]> {
    if (tokens.length === 0) return tokens;

    const reports = await mapPool(tokens, TOKEN_INFO_CONCURRENCY, async token => {
        const [rug, webacy] = await Promise.all([
            fetchRugcheckReport(token.address),
            fetchWebacyTradingLite(token.address),
        ]);

        if (!rug && !webacy) return [token.address, null] as const;

        const merged: RugcheckTokenInfoReport = {
            ...(rug ?? {}),
            ...(webacy ?? {}),
        };
        return [token.address, merged] as const;
    });

    const byMint = new Map(reports);
    return tokens.filter(token => {
        const report = byMint.get(token.address);
        return !shouldDropMemecoinAsRug(report ?? null, {
            liquidityUsd: token.liquidity,
            volume24hUsd: token.volume24hUSD,
            priceChange24hPercent: token.priceChange24hPercent,
        });
    });
}

interface PumpCoinMeta {
    total_supply?: number;
    total_supply_str?: string;
    base_decimals?: number;
}

async function fetchMemecoinSupplyAndHolders(mint: string): Promise<{
    holders: number | null;
    totalSupply: number | null;
    circulatingSupply: number | null;
}> {
    const [rug, pump] = await Promise.all([
        fetchDexscreenerJson<RugcheckReport>(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`),
        fetchDexscreenerJson<PumpCoinMeta>(`https://frontend-api-v3.pump.fun/coins/${encodeURIComponent(mint)}`),
    ]);

    const holders =
        typeof rug?.totalHolders === 'number' && Number.isFinite(rug.totalHolders) && rug.totalHolders > 0
            ? Math.round(rug.totalHolders)
            : null;

    const rugDecimals = rug?.token?.decimals;
    const rugSupplyRaw = rug?.token?.supply;
    const circulatingFromRug =
        typeof rugSupplyRaw === 'number' &&
        Number.isFinite(rugSupplyRaw) &&
        typeof rugDecimals === 'number' &&
        Number.isFinite(rugDecimals) &&
        rugDecimals >= 0
            ? rugSupplyRaw / 10 ** rugDecimals
            : null;

    const pumpDecimals = pump?.base_decimals;
    const pumpSupplyRaw =
        typeof pump?.total_supply === 'number' && Number.isFinite(pump.total_supply)
            ? pump.total_supply
            : Number.parseFloat(pump?.total_supply_str ?? '');
    const totalFromPump =
        Number.isFinite(pumpSupplyRaw) &&
        typeof pumpDecimals === 'number' &&
        Number.isFinite(pumpDecimals) &&
        pumpDecimals >= 0
            ? pumpSupplyRaw / 10 ** pumpDecimals
            : null;

    const totalSupply = totalFromPump ?? circulatingFromRug;
    const circulatingSupply = circulatingFromRug ?? totalFromPump;

    return {
        holders,
        totalSupply: totalSupply != null && totalSupply > 0 ? totalSupply : null,
        circulatingSupply: circulatingSupply != null && circulatingSupply > 0 ? circulatingSupply : null,
    };
}

/** Live single-token lookup for the memecoin detail page — no quality filtering (the user already has the address). */
export async function fetchSolanaMemecoinDetail(mint: string): Promise<MemecoinDetail | null> {
    const [pairs, supplyHolders] = await Promise.all([
        fetchDexscreenerJson<DexscreenerPair[]>(`${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${mint}`),
        fetchMemecoinSupplyAndHolders(mint),
    ]);
    const solanaPairs = (pairs ?? []).filter(
        pair => pair.chainId === SOLANA_CHAIN_ID && pair.baseToken?.address === mint,
    );
    if (solanaPairs.length === 0) return null;

    const best = solanaPairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
    const name = best.baseToken?.name?.trim();
    const symbol = best.baseToken?.symbol?.trim();
    if (!name || !symbol) return null;

    const volume1h = best.volume?.h1;
    const fdv = best.fdv ?? best.marketCap ?? null;

    return {
        address: mint,
        name,
        symbol,
        ...(best.info?.imageUrl ? { logoURI: best.info.imageUrl } : {}),
        price: Number.parseFloat(best.priceUsd ?? '0') || 0,
        ...(best.priceChange?.h1 != null ? { priceChange1hPercent: best.priceChange.h1 } : {}),
        priceChange24hPercent: best.priceChange?.h24 ?? 0,
        liquidityUsd: best.liquidity?.usd ?? 0,
        volume1hUsd: typeof volume1h === 'number' && Number.isFinite(volume1h) && volume1h > 0 ? volume1h : null,
        volume24hUsd: best.volume?.h24 ?? 0,
        marketCap: best.marketCap ?? best.fdv ?? 0,
        fdv: typeof fdv === 'number' && Number.isFinite(fdv) && fdv > 0 ? fdv : null,
        totalSupply: supplyHolders.totalSupply,
        circulatingSupply: supplyHolders.circulatingSupply,
        holders: supplyHolders.holders,
        trade1h: txnCount(best.txns?.h1),
        trade24h: txnCount(best.txns?.h24),
        pairCreatedAt: best.pairCreatedAt ?? null,
        dexId: best.dexId ?? 'unknown',
        pairAddress: best.pairAddress ?? '',
        dexScreenerUrl: best.url ?? `https://dexscreener.com/solana/${best.pairAddress ?? mint}`,
    };
}

export function memecoinDetailToToken(detail: MemecoinDetail): Token {
    return {
        category: 'memecoin',
        address: detail.address,
        name: detail.name,
        symbol: detail.symbol,
        decimals: 9,
        ...(detail.logoURI ? { logoURI: detail.logoURI } : {}),
        liquidity: detail.liquidityUsd,
        ...(detail.volume1hUsd != null ? { volume1hUSD: detail.volume1hUsd } : {}),
        volume24hUSD: detail.volume24hUsd,
        ...(detail.trade1h != null ? { trade1h: detail.trade1h } : {}),
        ...(detail.trade24h != null ? { trade24h: detail.trade24h } : {}),
        price: detail.price,
        priceChange24hPercent: detail.priceChange24hPercent,
        ...(detail.priceChange1hPercent != null ? { priceChange1hPercent: detail.priceChange1hPercent } : {}),
        marketCap: detail.marketCap,
    } satisfies Token;
}

/**
 * Live Solana token search for the cmdk palette.
 * Mint/CA → exact DexScreener token lookup.
 * Free text → DexScreener pair search, Solana-only, one row per base mint.
 */
export async function searchSolanaMemecoins(query: string, limit = 20): Promise<Token[]> {
    const q = query.trim();
    if (!q) return [];

    if (looksLikeSolanaMintAddress(q)) {
        const detail = await fetchSolanaMemecoinDetail(q);
        return detail ? [memecoinDetailToToken(detail)] : [];
    }

    if (q.length < 2) return [];

    const body = await fetchDexscreenerJson<{ pairs?: DexscreenerPair[] }>(
        `${DEXSCREENER_ORIGIN}/latest/dex/search?q=${encodeURIComponent(q)}`,
    );
    const pairs = (body?.pairs ?? []).filter(pair => pair.chainId === SOLANA_CHAIN_ID);
    if (pairs.length === 0) return [];

    const nowMs = Date.now();
    const bestByMint = new Map<string, DexscreenerPair>();
    for (const pair of pairs) {
        const mint = pair.baseToken?.address?.trim();
        if (!mint) continue;
        const prev = bestByMint.get(mint);
        if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) {
            bestByMint.set(mint, pair);
        }
    }

    const tokens: Token[] = [];
    for (const pair of bestByMint.values()) {
        if (!pair.baseToken?.address?.trim() || !pair.baseToken?.name?.trim() || !pair.baseToken?.symbol?.trim()) {
            continue;
        }
        tokens.push(pairToToken(pair, nowMs));
        if (tokens.length >= limit) break;
    }

    return enrichMissingMemecoinLogos(tokens);
}
