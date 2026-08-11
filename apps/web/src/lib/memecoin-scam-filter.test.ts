import { describe, expect, test } from 'bun:test';

import {
    isAcceptableWithoutTokenInfo,
    isRugFromMarketSignals,
    isRugFromTokenInfoReport,
    shouldDropMemecoinAsRug,
    type RugcheckTokenInfoReport,
} from './memecoin-scam-filter';

/** Snapshot of MCX (7kt5…pump) Rugcheck fields that matter for the gate. */
const MCX_REPORT: RugcheckTokenInfoReport = {
    rugged: false,
    graphInsidersDetected: 202,
    token: { supply: 998098733457540, decimals: 6 },
    insiderNetworks: [
        {
            size: 202,
            type: 'transfer',
            tokenAmount: 947307344992140,
        },
    ],
    risks: [
        {
            name: 'High holder correlation',
            value: '(19)',
            level: 'warn',
            score: 2900,
        },
    ],
    topHolders: [
        { pct: 3.901454323162465, insider: false, owner: '8MqSiRwGLpVault1111111111111111111111111' },
        { pct: 0.4762044737025204, insider: false, owner: '7TumNy6a1111111111111111111111111111111' },
        { pct: 0.4762031291236175, insider: false, owner: '3pS3ejJc1111111111111111111111111111111' },
        { pct: 0.4762028681286966, insider: false, owner: '4F1C4pKB1111111111111111111111111111111' },
        { pct: 0.47620099962116574, insider: false, owner: 'Cd4NwPVe1111111111111111111111111111111' },
        { pct: 0.4762000381610738, insider: false, owner: '5azcz32W1111111111111111111111111111111' },
        { pct: 0.4761991422237582, insider: false, owner: 'HnbuD3W71111111111111111111111111111111' },
        { pct: 0.47619888066456445, insider: false, owner: '8auQKEZn1111111111111111111111111111111' },
    ],
    markets: [
        {
            pubkey: '8MqSiRwGLpVault1111111111111111111111111',
            lp: { base: 38940366.185909, pctSupply: 0 },
        },
    ],
};

describe('memecoin rug filter', () => {
    test('MCX Token Info (95% insiders / 202 graph wallets) is a rug', () => {
        expect(isRugFromTokenInfoReport(MCX_REPORT)).toBe(true);
        expect(
            shouldDropMemecoinAsRug(MCX_REPORT, {
                liquidityUsd: 67_000,
                volume24hUsd: 29_000,
                priceChange24hPercent: 2700,
                pairAgeHours: 1.8,
            }),
        ).toBe(true);
    });

    test('MCX cartoon pump is dropped from Dex signals alone', () => {
        expect(
            isRugFromMarketSignals({
                liquidityUsd: 67_000,
                volume24hUsd: 29_000,
                priceChange24hPercent: 2700,
                pairAgeHours: 1.8,
            }),
        ).toBe(true);
    });

    test('Toady-style wash dump (vol/liq ~50) is a rug', () => {
        expect(
            isRugFromMarketSignals({
                liquidityUsd: 24_900,
                volume24hUsd: 1_250_000,
                priceChange24hPercent: 187,
                pairAgeHours: 20,
            }),
        ).toBe(true);
        expect(
            shouldDropMemecoinAsRug(
                { rugged: false, graphInsidersDetected: 0, risks: [] },
                {
                    liquidityUsd: 24_900,
                    volume24hUsd: 1_250_000,
                    priceChange24hPercent: 187,
                },
            ),
        ).toBe(true);
    });

    test('cartoon pumps still drop without Token Info; normal hot movers do not', () => {
        expect(
            shouldDropMemecoinAsRug(null, {
                liquidityUsd: 67_000,
                volume24hUsd: 29_000,
                priceChange24hPercent: 2700,
            }),
        ).toBe(true);
        // Typical trending memecoin (+250%) must not be wiped just because Rugcheck missed.
        expect(
            shouldDropMemecoinAsRug(null, {
                liquidityUsd: 40_000,
                volume24hUsd: 200_000,
                priceChange24hPercent: 250,
            }),
        ).toBe(false);
        expect(
            isAcceptableWithoutTokenInfo({
                liquidityUsd: 40_000,
                volume24hUsd: 200_000,
                priceChange24hPercent: 250,
            }),
        ).toBe(true);
    });

    test('calm liquid market without Token Info can still pass market gate', () => {
        expect(
            isAcceptableWithoutTokenInfo({
                liquidityUsd: 80_000,
                volume24hUsd: 120_000,
                priceChange24hPercent: 12,
            }),
        ).toBe(true);
        expect(
            shouldDropMemecoinAsRug(null, {
                liquidityUsd: 80_000,
                volume24hUsd: 120_000,
                priceChange24hPercent: 12,
            }),
        ).toBe(false);
    });

    test('clean Token Info + normal market is kept', () => {
        expect(
            shouldDropMemecoinAsRug(
                {
                    rugged: false,
                    graphInsidersDetected: 0,
                    topHolders: [
                        { pct: 2.1, owner: 'a' },
                        { pct: 1.8, owner: 'b' },
                        { pct: 1.5, owner: 'c' },
                    ],
                },
                {
                    liquidityUsd: 120_000,
                    volume24hUsd: 400_000,
                    priceChange24hPercent: 18,
                },
            ),
        ).toBe(false);
    });
});
