import { NextResponse } from 'next/server';

import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

const DEXSCREENER_ORIGIN = 'https://api.dexscreener.com';
const SOLANA_CHAIN_ID = 'solana';
const FETCH_TIMEOUT_MS = 4_000;

interface DexscreenerPair {
    chainId?: string;
    pairAddress?: string;
    baseToken?: { address?: string };
    priceUsd?: string;
    priceChange?: { m5?: number; h1?: number; h24?: number };
    liquidity?: { usd?: number };
    marketCap?: number;
    fdv?: number;
}

export interface MemecoinLivePriceResponse {
    mint: string;
    price: number;
    priceChange5mPercent: number | null;
    priceChange1hPercent: number | null;
    priceChange24hPercent: number | null;
    liquidityUsd: number | null;
    marketCap: number | null;
    pairAddress: string | null;
    asOf: number;
}

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const mint = (url.searchParams.get('address') ?? url.searchParams.get('mint') ?? '').trim();
    if (!looksLikeSolanaMintAddress(mint)) {
        return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 });
    }

    try {
        const res = await fetch(`${DEXSCREENER_ORIGIN}/tokens/v1/${SOLANA_CHAIN_ID}/${mint}`, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
            return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
        }

        const pairs = (await res.json()) as DexscreenerPair[];
        const solanaPairs = (Array.isArray(pairs) ? pairs : []).filter(
            pair => pair.chainId === SOLANA_CHAIN_ID && pair.baseToken?.address === mint,
        );
        if (solanaPairs.length === 0) {
            return NextResponse.json({ error: 'No Solana pair found' }, { status: 404 });
        }

        const best = solanaPairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
        const price = Number.parseFloat(best.priceUsd ?? '');
        if (!Number.isFinite(price) || price <= 0) {
            return NextResponse.json({ error: 'No price' }, { status: 404 });
        }

        const body: MemecoinLivePriceResponse = {
            mint,
            price,
            priceChange5mPercent: best.priceChange?.m5 ?? null,
            priceChange1hPercent: best.priceChange?.h1 ?? null,
            priceChange24hPercent: best.priceChange?.h24 ?? null,
            liquidityUsd: best.liquidity?.usd ?? null,
            marketCap: best.marketCap ?? best.fdv ?? null,
            pairAddress: best.pairAddress ?? null,
            asOf: Math.floor(Date.now() / 1000),
        };

        return NextResponse.json(body, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch live price' }, { status: 502 });
    }
}
