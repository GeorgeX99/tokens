/**
 * Discovery scam gate.
 *
 * 1) Token Info panel metrics (Top 10 · Insiders · Bundlers · Dev) — any ≥ ~35%,
 *    or Rugcheck graph insider cohort / `rugged` flag.
 * 2) Strict Dex fingerprints only: wash volume (≥40×) and cartoon pumps (≥1000%).
 */

export const RUG_TOKEN_INFO_THRESHOLD_PERCENT = 35;
/** Rugcheck graph insider wallets — MCX-class bundles land well above this. */
export const RUG_GRAPH_INSIDERS_THRESHOLD = 10;
/** 24h volume / liquidity — wash dumps (e.g. Toady ~50×) clear this easily. */
export const RUG_MAX_VOLUME_LIQUIDITY_RATIO = 40;
/** Cartoon pump without needing Token Info (MCX-class +1000%+). */
export const RUG_EXTREME_PRICE_CHANGE_PERCENT = 1_000;

export interface TokenInfoRugMetrics {
    top10HoldersPercent: number | null;
    insidersPercent: number | null;
    bundlersPercent: number | null;
    devHoldingPercent: number | null;
}

export interface MarketRugSignals {
    liquidityUsd: number;
    volume24hUsd: number;
    priceChange24hPercent: number;
    /** Hours since pair creation when known. */
    pairAgeHours?: number | null;
}

export interface RugcheckHolderRow {
    pct?: number;
    insider?: boolean;
    owner?: string;
    address?: string;
    amount?: number | string;
}

export interface RugcheckRiskRow {
    name?: string;
    level?: string;
    value?: string;
    score?: number;
}

export interface RugcheckMarketRow {
    pubkey?: string;
    lp?: {
        base?: number;
        pctSupply?: number;
    };
}

export interface RugcheckKnownAccount {
    name?: string;
    type?: string;
}

export interface RugcheckInsiderNetwork {
    tokenAmount?: number;
    size?: number;
    type?: string;
}

export interface RugcheckTokenInfoReport {
    rugged?: boolean;
    topHolders?: RugcheckHolderRow[];
    risks?: RugcheckRiskRow[];
    markets?: RugcheckMarketRow[];
    knownAccounts?: Record<string, RugcheckKnownAccount | undefined>;
    insiderNetworks?: RugcheckInsiderNetwork[] | null;
    graphInsidersDetected?: number;
    score?: number;
    score_normalised?: number;
    token?: { supply?: number; decimals?: number };
    /** Webacy trading-lite fields when merged in. */
    Top10Holders?: number;
    BundlerPercentageHolding?: number;
    BundlerPercentageOnLaunch?: number;
    SniperPercentageHolding?: number;
    SniperPercentageOnLaunch?: number;
    DevHoldingPercentage?: number;
}

const LP_ACCOUNT_NAME = /(amm|raydium|orca|meteora|pool|vault|liquidity|pump\s*fun)/i;

function finitePct(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
}

function holderOwner(row: RugcheckHolderRow): string {
    return (row.owner ?? row.address ?? '').trim();
}

function isLiquidityAccount(
    owner: string,
    marketPubkeys: ReadonlySet<string>,
    knownAccounts: Record<string, RugcheckKnownAccount | undefined> | undefined,
): boolean {
    if (!owner) return false;
    if (marketPubkeys.has(owner)) return true;
    const known = knownAccounts?.[owner];
    if (!known) return false;
    return LP_ACCOUNT_NAME.test(known.name ?? '') || LP_ACCOUNT_NAME.test(known.type ?? '');
}

function sumPct(rows: readonly RugcheckHolderRow[], count?: number): number {
    const slice = typeof count === 'number' ? rows.slice(0, count) : rows;
    return slice.reduce((sum, row) => {
        const pct = typeof row.pct === 'number' && Number.isFinite(row.pct) ? row.pct : 0;
        return sum + pct;
    }, 0);
}

function freeFloatHolders(report: RugcheckTokenInfoReport): RugcheckHolderRow[] {
    const marketPubkeys = new Set(
        (report.markets ?? []).map(market => market.pubkey?.trim()).filter((value): value is string => Boolean(value)),
    );
    return (report.topHolders ?? []).filter(row => {
        const owner = holderOwner(row);
        return !isLiquidityAccount(owner, marketPubkeys, report.knownAccounts);
    });
}

/** LP share of supply from market reserves (Token Info “not in the clone-wallet cohort”). */
function lpSharePercent(report: RugcheckTokenInfoReport): number {
    const supplyRaw = report.token?.supply;
    const decimals = report.token?.decimals;
    if (!(typeof supplyRaw === 'number' && supplyRaw > 0)) return 0;
    const supplyUi =
        typeof decimals === 'number' && decimals >= 0 ? supplyRaw / 10 ** decimals : supplyRaw;

    let best = 0;
    for (const market of report.markets ?? []) {
        const pctSupply = market.lp?.pctSupply;
        if (typeof pctSupply === 'number' && Number.isFinite(pctSupply) && pctSupply > best) {
            best = pctSupply;
            continue;
        }
        const base = market.lp?.base;
        if (typeof base === 'number' && Number.isFinite(base) && supplyUi > 0) {
            best = Math.max(best, (base / supplyUi) * 100);
        }
    }
    return Math.min(Math.max(best, 0), 100);
}

interface EqualBagCluster {
    size: number;
    /** Sum of % in the Rugcheck top-holder sample. */
    visiblePct: number;
    /** Share of visible free-float that sits in this equal-bag cluster. */
    dominance: number;
}

/**
 * Find the largest near-equal bag cluster (classic insider/bundler fingerprint).
 * Rugcheck only returns ~20 holders, so a wall of ~1% clone wallets is only a sample
 * of a much larger cohort — dominance lets us extrapolate toward Token Info’s %.
 *
 * Bundlers jitter amounts slightly, so we cluster by proximity (not exact equality).
 */
function largestEqualBagCluster(holders: readonly RugcheckHolderRow[]): EqualBagCluster | null {
    if (holders.length < 3) return null;

    const pcts = holders
        .map(row => (typeof row.pct === 'number' && Number.isFinite(row.pct) ? row.pct : 0))
        .filter(pct => pct > 0)
        .sort((a, b) => a - b);
    if (pcts.length < 3) return null;

    const freeSum = pcts.reduce((sum, pct) => sum + pct, 0);
    if (freeSum <= 0) return null;

    // Greedy clusters: each wallet joins the open group if within 10% relative (min 0.05pp).
    let best: EqualBagCluster | null = null;
    let start = 0;
    while (start < pcts.length) {
        let end = start;
        let sum = pcts[start]!;
        while (end + 1 < pcts.length) {
            const next = pcts[end + 1]!;
            const anchor = sum / (end - start + 1);
            const tol = Math.max(0.05, anchor * 0.1);
            if (Math.abs(next - anchor) > tol) break;
            end += 1;
            sum += next;
        }
        const size = end - start + 1;
        if (size >= 3) {
            const dominance = sum / freeSum;
            if (!best || size > best.size || (size === best.size && sum > best.visiblePct)) {
                best = { size, visiblePct: sum, dominance };
            }
        }
        start = end + 1;
    }

    return best;
}

/**
 * Extrapolate insider/bundler % when equal-bag wallets dominate the free-float sample.
 * Example: 19× ~1% clones in top 20 ⇒ ~92% of visible free float ⇒ ~97% of non-LP supply.
 */
function sybilCohortPercentFromHolders(report: RugcheckTokenInfoReport): number | null {
    const holders = freeFloatHolders(report);
    const cluster = largestEqualBagCluster(holders);
    if (!cluster) return null;

    // Need a real wall of clones, not 3 random coincidences.
    if (cluster.size < 5 || cluster.dominance < 0.5) {
        return cluster.visiblePct >= RUG_TOKEN_INFO_THRESHOLD_PERCENT ? cluster.visiblePct : null;
    }

    const lpPct = lpSharePercent(report);
    const extrapolated = cluster.dominance * (100 - lpPct);
    return Math.min(100, Math.max(cluster.visiblePct, extrapolated));
}

function holderCorrelationWalletCount(report: RugcheckTokenInfoReport): number {
    const correlation = (report.risks ?? []).find(risk => /holder correlation/i.test(risk.name ?? ''));
    if (!correlation) return 0;
    const match = String(correlation.value ?? '').match(/(\d+)/);
    return match ? Number.parseInt(match[1]!, 10) : 0;
}

/** Top 10 free-float holders (LP / AMM vaults excluded — same idea as Token Info “Top 10 H.”). */
export function top10HoldersPercentFromReport(report: RugcheckTokenInfoReport): number | null {
    const fromWebacy = finitePct(report.Top10Holders);
    if (fromWebacy != null) return fromWebacy;

    const holders = freeFloatHolders(report);
    if (holders.length === 0) return null;
    return sumPct(holders, 10);
}

/**
 * Insider cohort % — networks / flagged wallets / snipers when present;
 * otherwise equal-bag sybil extrapolation (covers Token Info “Insiders 97%” cases
 * where Rugcheck leaves insiderNetworks empty).
 */
export function insidersPercentFromReport(report: RugcheckTokenInfoReport): number | null {
    const supply = report.token?.supply;
    let networkPct = 0;
    if (typeof supply === 'number' && Number.isFinite(supply) && supply > 0) {
        for (const network of report.insiderNetworks ?? []) {
            const amount = network.tokenAmount;
            if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
                networkPct += (amount / supply) * 100;
            }
        }
    }

    const flaggedPct = sumPct((report.topHolders ?? []).filter(row => row.insider === true));
    const sniperPct = Math.max(
        finitePct(report.SniperPercentageHolding) ?? 0,
        finitePct(report.SniperPercentageOnLaunch) ?? 0,
    );
    const sybilPct = sybilCohortPercentFromHolders(report) ?? 0;

    const combined = Math.max(networkPct, flaggedPct, sniperPct, sybilPct);
    return combined > 0 ? Math.min(combined, 100) : null;
}

/**
 * Bundler cohort % — Webacy when present; otherwise same equal-bag / correlation signals
 * Token Info usually mirrors into “Bundlers”.
 */
export function bundlersPercentFromReport(report: RugcheckTokenInfoReport): number | null {
    const fromWebacy = Math.max(
        finitePct(report.BundlerPercentageHolding) ?? 0,
        finitePct(report.BundlerPercentageOnLaunch) ?? 0,
    );
    if (fromWebacy > 0) return fromWebacy;

    const sybilPct = sybilCohortPercentFromHolders(report) ?? 0;
    const correlatedWallets = holderCorrelationWalletCount(report);
    // Rugcheck only samples top holders; 10+ correlated wallets ⇒ over the rug line.
    const correlationFloor = correlatedWallets >= 10 ? RUG_TOKEN_INFO_THRESHOLD_PERCENT : 0;

    const combined = Math.max(sybilPct, correlationFloor);
    return combined > 0 ? Math.min(combined, 100) : null;
}

export function extractTokenInfoRugMetrics(report: RugcheckTokenInfoReport | null | undefined): TokenInfoRugMetrics {
    if (!report) {
        return {
            top10HoldersPercent: null,
            insidersPercent: null,
            bundlersPercent: null,
            devHoldingPercent: null,
        };
    }
    return {
        top10HoldersPercent: top10HoldersPercentFromReport(report),
        insidersPercent: insidersPercentFromReport(report),
        bundlersPercent: bundlersPercentFromReport(report),
        devHoldingPercent: finitePct(report.DevHoldingPercentage),
    };
}

/** True when Token Info concentration metrics say this mint is a rug. */
export function isRugFromTokenInfo(metrics: TokenInfoRugMetrics, threshold = RUG_TOKEN_INFO_THRESHOLD_PERCENT): boolean {
    const checks = [
        metrics.top10HoldersPercent,
        metrics.insidersPercent,
        metrics.bundlersPercent,
        metrics.devHoldingPercent,
    ];
    return checks.some(value => typeof value === 'number' && value >= threshold);
}

export function isRugFromTokenInfoReport(
    report: RugcheckTokenInfoReport | null | undefined,
    threshold = RUG_TOKEN_INFO_THRESHOLD_PERCENT,
): boolean {
    if (!report) return false;
    if (report.rugged === true) return true;
    if (
        typeof report.graphInsidersDetected === 'number' &&
        Number.isFinite(report.graphInsidersDetected) &&
        report.graphInsidersDetected >= RUG_GRAPH_INSIDERS_THRESHOLD
    ) {
        return true;
    }
    return isRugFromTokenInfo(extractTokenInfoRugMetrics(report), threshold);
}

/**
 * Dex-only rug fingerprints (no Token Info required).
 * Keep these strict — most real runners look “hot”; only kill cartoon/wash cases.
 */
export function isRugFromMarketSignals(signals: MarketRugSignals): boolean {
    const liq = signals.liquidityUsd;
    const vol = signals.volume24hUsd;
    if (liq > 0 && Number.isFinite(liq) && Number.isFinite(vol)) {
        if (vol / liq >= RUG_MAX_VOLUME_LIQUIDITY_RATIO) return true;
    }

    const change = Math.abs(signals.priceChange24hPercent);
    if (Number.isFinite(change) && change >= RUG_EXTREME_PRICE_CHANGE_PERCENT) return true;

    return false;
}

/**
 * Missing Token Info: still apply Dex fingerprints, but do not require a “calm”
 * market — that wiped most legitimate trending memecoins (+100–400% movers).
 */
export function isAcceptableWithoutTokenInfo(signals: MarketRugSignals): boolean {
    return !isRugFromMarketSignals(signals);
}

/** Final discovery decision for one mint. */
export function shouldDropMemecoinAsRug(
    report: RugcheckTokenInfoReport | null | undefined,
    signals: MarketRugSignals,
): boolean {
    if (isRugFromMarketSignals(signals)) return true;
    if (!report) return false;
    return isRugFromTokenInfoReport(report);
}
