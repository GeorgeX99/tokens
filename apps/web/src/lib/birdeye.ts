interface TokenExtensions {
    coingeckoId?: string;
    website?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
    description?: string;
    github?: string;
}

export interface TokenOverview {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    extensions?: TokenExtensions;
    price: number;
    priceChange24hPercent: number;
    marketCap: number;
    fdv: number;
    liquidity: number;
    volume24h: number;
    holder: number;
    totalSupply: number;
    circulatingSupply: number;
    lastTradeHumanTime: string;
}

export interface OHLCVData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    /** Candle volume in USD. Prefer Birdeye OHLCV v3 `v_usd`. */
    volume: number;
}

export type TimeInterval = '1s' | '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W';

export interface TokenMarketToken {
    address: string;
    decimals?: number;
    symbol?: string;
    icon?: string;
    name?: string;
}

export interface TokenMarket {
    /** Market/pool address */
    address: string;
    /** Human-readable name like "JitoSOL-SOL" */
    name?: string;
    base?: TokenMarketToken;
    quote?: TokenMarketToken;
    source?: string;
    createdAt?: string;
    liquidity?: number;
    volume24h?: number;
    trade24h?: number;
    trade24hChangePercent?: number;
    uniqueWallet24h?: number;
    uniqueWallet24hChangePercent?: number;
    price?: number | null;
}
