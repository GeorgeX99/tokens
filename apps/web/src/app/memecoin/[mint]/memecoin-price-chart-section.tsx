'use client';

import dynamic from 'next/dynamic';
import { PriceChartSkeleton } from '@/app/token/[address]/components/price-chart-skeleton';

interface MemecoinPriceChartSectionProps {
    mint: string;
    symbol: string;
    tokenName?: string;
    logoURI?: string;
    currentPrice?: number;
    priceChange24h?: number;
}

const MintPriceChart = dynamic(() => import('@/components/mint-price-chart').then(m => m.MintPriceChart), {
    ssr: false,
    loading: () => <PriceChartSkeleton />,
});

export function MemecoinPriceChartSection({
    mint,
    symbol,
    tokenName,
    logoURI,
    currentPrice,
    priceChange24h,
}: MemecoinPriceChartSectionProps) {
    return (
        <MintPriceChart
            mint={mint}
            symbol={symbol}
            tokenName={tokenName}
            logoURI={logoURI}
            currentPrice={currentPrice}
            priceChange24h={priceChange24h}
        />
    );
}
