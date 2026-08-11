import Image from 'next/image';

const BENEFITS = [
    {
        title: 'Resolve any asset',
        body: 'Every variant mint, mapped to one canonical asset. cbBTC, WBTC, tBTC: all resolve to Bitcoin.',
        image: '/landing/benefits/03.png',
        alt: 'Bitcoin card with 8+ variants',
    },
    {
        title: 'Best markets, preselected',
        body: 'The deepest pool per variant, ranked by real liquidity. No need for custom routing logic on your side.',
        image: '/landing/benefits/02.png',
        alt: 'Hype-USDC market selection',
    },
    {
        title: 'Verified by default',
        body: 'Spoofed tokens and orphaned mints filtered out automatically before they even reach your code.',
        image: '/landing/benefits/01.png',
        alt: 'XRP verified token',
    },
];

export function BenefitsSection() {
    return (
        <section className="bg-[#0F0F10]">
            <div className="mx-auto flex max-w-[1120px] flex-col items-end gap-[72px] px-6 py-20 md:py-32">
                <div className="flex w-full flex-col items-start gap-8 md:flex-row md:gap-8">
                    <h2 className="flex-1 font-diatype-medium text-[length:var(--text-display)] leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-text-extra-high text-balance">
                        Skip the plumbing.
                    </h2>
                    <p className="flex-1 font-diatype-medium text-[length:var(--text-title-md)] leading-[var(--leading-snug)] tracking-[var(--tracking-tight)] text-text-low text-pretty">
                        We verify assets, combine variants, and filter markets, so you don&rsquo;t have to.
                    </p>
                </div>

                <div className="flex w-full flex-col md:h-[462px] md:flex-row md:items-stretch">
                    {BENEFITS.map((benefit, idx) => (
                        <BenefitCard key={benefit.title} benefit={benefit} index={idx} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function BenefitCard({
    benefit,
    index,
}: {
    benefit: (typeof BENEFITS)[number];
    index: number;
}) {
    const isMiddle = index === 1;
    const verticalStack = index > 0 ? 'border-t-0 md:border-t' : '';
    const horizontalRow = isMiddle
        ? ''
        : index === 0
          ? 'md:border-r-0'
          : 'md:border-l-0';
    const borderClass =
        `border border-white/[0.08] ${verticalStack} ${horizontalRow}`.trim();

    return (
        <div
            className={`flex min-w-0 flex-1 flex-col items-start gap-7 p-8 ${borderClass}`}
        >
            <div className="relative w-full flex-1 min-h-[240px] overflow-hidden">
                <Image
                    src={benefit.image}
                    alt={benefit.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 480px"
                    quality={90}
                    className="object-cover"
                />
            </div>
            <div className="flex w-full flex-col items-start gap-3">
                <h3 className="font-diatype-medium text-[length:var(--text-title-md)] leading-[var(--leading-snug)] text-text-extra-high">
                    {benefit.title}
                </h3>
                <p className="font-inter text-[length:var(--text-body-md-size)] leading-[var(--leading-normal)] text-text-low text-pretty">
                    {benefit.body}
                </p>
            </div>
        </div>
    );
}
