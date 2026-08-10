import 'server-only';

import { connection } from 'next/server';
import { getVariantByMint, resolveAlias } from '@tokens/asset-registry';
import type { Token } from '@/lib/types';

// Live Solana memecoin discovery via DexScreener's free public API. Nothing here is
// pre-baked into the codebase — every list/detail request hits DexScreener at request
// time (behind a short revalidate window), the same way the "Trending" tab hits Birdeye
// live rather than shipping a static token list.

const DEXSCREENER_ORIGIN = 'https://api.dexscreener.com';
const SOLANA_CHAIN_ID = 'solana';
const FETCH_TIMEOUT_MS = 6_000;
const MAX_BATCH_SIZE = 30;
const DISCOVERY_REVALIDATE_SECONDS = 30;

const MIN_LIQUIDITY_USD = 10_000;
const MIN_VOLUME_24H_USD = 5_000;
const MIN_PAIR_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RESULT_LIMIT = 40;

// Filters out phishing bait / corporate-impersonation style names that otherwise pass
// the liquidity, volume, and age checks.
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
    liquidity?: { usd?: number };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
    info?: { imageUrl?: string };
}

interface DexscreenerDiscoveryEntry {
    chainId?: string;
    tokenAddress?: string;
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
    volume24hUsd: number;
    marketCap: number;
    pairCreatedAt: number | null;
    dexId: string;
    pairAddress: string;
    dexScreenerUrl: string;
}

async function fetchDexscreenerJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: { accept: 'application/json' },
            next: { revalidate: DISCOVERY_REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/** Solana token addresses surfaced by DexScreener's discovery feeds (boosted + newly profiled tokens). */
async function discoverCandidateAddresses(maxCandidates: number): Promise<string[]> {
    const [topBoosts, latestBoosts, latestProfiles] = await Promise.all([
        fetchDexscreenerJson<DexscreenerDiscoveryEntry[]>(`${DEXSCREENER_ORIGIN}/token-boosts/top/v1`),
        fetchDexscreenerJson<DexscreenerDiscoveryEntry[]>(`${DEXSCREENER_ORIGIN}/token-boosts/latest/v1`),
        fetchDexscreenerJson<DexscreenerDiscoveryEntry[]>(`${DEXSCREENER_ORIGIN}/token-profiles/latest/v1`),
    ]);

    const seen = new Set<string>();
    const addresses: string[] = [];
    for (const entry of [...(topBoosts ?? []), ...(latestBoosts ?? []), ...(latestProfiles ?? [])]) {
        if (entry.chainId !== SOLANA_CHAIN_ID) continue;
        const address = entry.tokenAddress?.trim();
        if (!address || seen.has(address)) continue;
        seen.add(address);
        addresses.push(address);
        if (addresses.length >= maxCandidates) break;
    }
    return addresses;
}

async function fetchPairsForAddresses(addresses: string[]): Promise<DexscreenerPair[]> {
    const batches = chunk(addresses, MAX_BATCH_SIZE);
    const results = await Promise.all(
        batches.map(batch =>
            fetchDexscreenerJson<DexscreenerPair[]>(`${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${batch.join(',')}`),
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

function passesQualityFilters(pair: DexscreenerPair, nowMs: number): boolean {
    const address = pair.baseToken?.address?.trim();
    const name = pair.baseToken?.name?.trim();
    const symbol = pair.baseToken?.symbol?.trim();
    if (!address || !name || !symbol) return false;
    if ((pair.liquidity?.usd ?? 0) < MIN_LIQUIDITY_USD) return false;
    if ((pair.volume?.h24 ?? 0) < MIN_VOLUME_24H_USD) return false;
    if (!pair.pairCreatedAt || nowMs - pair.pairCreatedAt < MIN_PAIR_AGE_MS) return false;
    if (looksSuspicious(name, symbol)) return false;
    if (collidesWithExistingListing(address, name, symbol)) return false;
    return true;
}

function pairToToken(pair: DexscreenerPair, nowMs: number): Token {
    const address = pair.baseToken!.address!.trim();
    const name = pair.baseToken!.name!.trim();
    const symbol = pair.baseToken!.symbol!.trim();

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
        price: Number.parseFloat(pair.priceUsd ?? '0') || 0,
        priceChange24hPercent: pair.priceChange?.h24 ?? 0,
        ...(pair.priceChange?.h1 != null ? { priceChange1hPercent: pair.priceChange.h1 } : {}),
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        asOf: nowMs,
    } satisfies Token;
}

/** Live-fetches, filters, and ranks trending Solana memecoins straight from DexScreener. */
export async function fetchTrendingSolanaMemecoins(limit = DEFAULT_RESULT_LIMIT): Promise<Token[]> {
    // Opt into request time before reading the clock (cacheComponents / prerender).
    await connection();
    const nowMs = Date.now();

    const candidates = await discoverCandidateAddresses(limit * 3);
    if (candidates.length === 0) return [];

    const pairs = await fetchPairsForAddresses(candidates);
    const bestPerToken = pickBestPairPerToken(pairs);

    return Array.from(bestPerToken.values())
        .filter(pair => passesQualityFilters(pair, nowMs))
        .map(pair => pairToToken(pair, nowMs))
        .sort((a, b) => b.volume24hUSD - a.volume24hUSD)
        .slice(0, limit);
}

/** Live single-token lookup for the memecoin detail page — no quality filtering (the user already has the address). */
export async function fetchSolanaMemecoinDetail(mint: string): Promise<MemecoinDetail | null> {
    const pairs = await fetchDexscreenerJson<DexscreenerPair[]>(
        `${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${mint}`,
    );
    const solanaPairs = (pairs ?? []).filter(
        pair => pair.chainId === SOLANA_CHAIN_ID && pair.baseToken?.address === mint,
    );
    if (solanaPairs.length === 0) return null;

    const best = solanaPairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
    const name = best.baseToken?.name?.trim();
    const symbol = best.baseToken?.symbol?.trim();
    if (!name || !symbol) return null;

    return {
        address: mint,
        name,
        symbol,
        ...(best.info?.imageUrl ? { logoURI: best.info.imageUrl } : {}),
        price: Number.parseFloat(best.priceUsd ?? '0') || 0,
        ...(best.priceChange?.h1 != null ? { priceChange1hPercent: best.priceChange.h1 } : {}),
        priceChange24hPercent: best.priceChange?.h24 ?? 0,
        liquidityUsd: best.liquidity?.usd ?? 0,
        volume24hUsd: best.volume?.h24 ?? 0,
        marketCap: best.marketCap ?? best.fdv ?? 0,
        pairCreatedAt: best.pairCreatedAt ?? null,
        dexId: best.dexId ?? 'unknown',
        pairAddress: best.pairAddress ?? '',
        dexScreenerUrl: best.url ?? `https://dexscreener.com/solana/${best.pairAddress ?? mint}`,
    };
}
