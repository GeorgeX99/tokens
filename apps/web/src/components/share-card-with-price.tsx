'use client';

import { formatPrice, formatPercent } from '@/lib/format';
import { Logo } from '@/components/logo';
import { ShareCardTokenLogo, type ShareCardStyleOverrides } from '@/components/share-card-with-chart';

interface ShareCardWithPriceProps {
    tokenName: string;
    logoURI?: string;
    percentChange: number;
    currentPrice: number;
    overrides?: ShareCardStyleOverrides;
}

export function ShareCardWithPrice({
    tokenName,
    logoURI,
    percentChange,
    currentPrice,
    overrides,
}: ShareCardWithPriceProps) {
    const gap = overrides?.contentGap ?? 54;
    const isPositive = percentChange >= 0;
    const formatted = formatPercent(percentChange);
    const sign = formatted[0];
    const value = formatted.slice(1);

    const signGradient = isPositive
        ? 'linear-gradient(to bottom, #22bd6f, #0c341f)'
        : 'linear-gradient(to bottom, #ef4444, #7f1d1d)';
    const valueGradient = isPositive
        ? 'linear-gradient(to bottom, #000000, rgba(12,52,31,0.88))'
        : 'linear-gradient(to bottom, #000000, rgba(127,29,29,0.88))';
    const bgGradient = isPositive
        ? 'radial-gradient(circle at 53% 99%, rgba(30,162,95,0.12), rgba(30,162,95,0) 70%)'
        : 'radial-gradient(circle at 53% 99%, rgba(220,38,38,0.12), rgba(220,38,38,0) 70%)';

    return (
        <div
            className="font-sans"
            style={{
                width: 1080,
                height: 1080,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                backgroundImage: bgGradient,
            }}
        >
            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap,
                    paddingBottom: 40,
                }}
            >
                {/* Token icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                    <ShareCardTokenLogo
                        key={`${tokenName}:${logoURI ?? ''}`}
                        tokenName={tokenName}
                        logoURI={logoURI}
                    />
                    <span
                        className="font-sans"
                        style={{
                            fontSize: 81,
                            fontVariationSettings: "'wght' 520",
                            color: 'rgba(28,28,29,0.88)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                        }}
                    >
                        {tokenName}
                    </span>
                </div>

                {/* Large percentage with gradient text */}
                <span
                    className="font-sans"
                    style={{
                        fontSize: 161,
                        fontVariationSettings: "'wght' 520",
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.1,
                        letterSpacing: '-2px',
                    }}
                >
                    <span
                        style={{
                            background: signGradient,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {sign}
                    </span>
                    <span
                        style={{
                            background: valueGradient,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {value}
                    </span>
                </span>

                {/* Price */}
                <span
                    className="font-sans"
                    style={{
                        fontSize: 81,
                        fontVariationSettings: "'wght' 520",
                        fontVariantNumeric: 'tabular-nums',
                        color: 'rgba(28,28,29,0.88)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                    }}
                >
                    {formatPrice(currentPrice)}
                </span>
            </div>

            {/* Bottom branding */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 73,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                }}
            >
                <Logo width={29} height={29} />
                <span
                    className="font-semibold"
                    style={{ fontSize: 35, color: 'rgba(28,28,29,0.72)', lineHeight: 1.17 }}
                >
                    SPL Token
                </span>
            </div>
        </div>
    );
}
