'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';
import { FooterAsteroidsEasterEgg } from '@/app/assets-api/footer-asteroids-easter-egg';
import { trackEvent } from '@/lib/posthog-client';
import {
    getSiteForkUrl,
    getSiteXUrl,
    getUpstreamRepoUrl,
    SITE_NAME,
    SPL_TOKEN_BASICS_URL,
} from '@/lib/site-brand';
import { Logo } from './logo';

type FooterTone = 'dark' | 'light';

interface SiteFooterProps {
    tone?: FooterTone;
    asteroidsOpen?: boolean;
    onAsteroidsOpenChange?: (open: boolean) => void;
}

export function SiteFooter({ tone = 'dark', asteroidsOpen, onAsteroidsOpenChange }: SiteFooterProps) {
    const labelClass =
        tone === 'dark'
            ? 'font-inter text-[length:var(--text-body-md-size)] leading-[var(--leading-normal)] text-text-extra-low'
            : 'font-inter text-[length:var(--text-body-md-size)] leading-[var(--leading-normal)] text-text-low';
    const linkClass =
        "relative font-inter text-[length:var(--text-body-md-size)] leading-[var(--leading-normal)] text-text-high hover:text-text-extra-high transition-colors before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-['']";
    const canLaunchAsteroids = asteroidsOpen !== undefined && onAsteroidsOpenChange !== undefined;
    const xUrl = getSiteXUrl();
    const forkUrl = getSiteForkUrl();
    const upstreamUrl = getUpstreamRepoUrl();

    return (
        <>
            <style>{`
                @keyframes footer-logo-hover-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .footer-logo-hover-spin img {
                    transform-origin: 50% 50%;
                }
                .footer-logo-hover-spin:hover img {
                    animation: footer-logo-hover-spin 700ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                @media (prefers-reduced-motion: reduce) {
                    .footer-logo-hover-spin:hover img { animation: none; }
                }
            `}</style>
            <footer className="flex w-full flex-col items-start gap-10 py-11 md:flex-row md:items-start md:justify-between md:gap-0">
                <div className="flex w-full flex-col items-start gap-10 md:w-auto md:flex-row md:gap-12 lg:gap-24">
                    <div className="flex flex-col items-start gap-6">
                        <p className={labelClass}>About</p>
                        <div className="flex max-w-[280px] flex-col items-start gap-3">
                            <p className="text-[13px] leading-relaxed text-text-medium">
                                SPL is Solana’s token standard. Most of what people build are memecoins. $SPL is that
                                truth, tokenized.
                            </p>
                            <a
                                href={upstreamUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-2.5 py-1 text-[12px] font-medium text-text-high transition-colors hover:bg-gray-50"
                                onClick={() =>
                                    trackEvent('external_link_clicked', {
                                        link_type: 'github_upstream',
                                        link_url: upstreamUrl,
                                        source: 'site_footer',
                                    })
                                }
                            >
                                <Github className="size-3.5 shrink-0" aria-hidden />
                                Forked from solana-foundation/tokens
                            </a>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-6">
                        <p className={labelClass}>Explore</p>
                        <div className="flex flex-col items-start gap-3">
                            <Link
                                href="/"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('nav_link_clicked', {
                                        destination: 'home',
                                        link_url: '/',
                                        source: 'site_footer',
                                    })
                                }
                            >
                                Home
                            </Link>
                            <Link
                                href="/#memecoins"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('nav_link_clicked', {
                                        destination: 'memecoins',
                                        link_url: '/#memecoins',
                                        source: 'site_footer',
                                    })
                                }
                            >
                                Memecoins
                            </Link>
                            <Link
                                href="/solana"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('nav_link_clicked', {
                                        destination: 'solana',
                                        link_url: '/solana',
                                        source: 'site_footer',
                                    })
                                }
                            >
                                Solana
                            </Link>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-6">
                        <p className={labelClass}>Socials & resources</p>
                        <div className="flex flex-col items-start gap-3">
                            <a
                                href={xUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('external_link_clicked', {
                                        link_type: 'x',
                                        link_url: xUrl,
                                        source: 'site_footer',
                                    })
                                }
                            >
                                X
                            </a>
                            <a
                                href={SPL_TOKEN_BASICS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('external_link_clicked', {
                                        link_type: 'docs',
                                        link_url: SPL_TOKEN_BASICS_URL,
                                        source: 'site_footer',
                                    })
                                }
                            >
                                SPL Token basics
                            </a>
                            <a
                                href={forkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={linkClass}
                                onClick={() =>
                                    trackEvent('external_link_clicked', {
                                        link_type: 'github',
                                        link_url: forkUrl,
                                        source: 'site_footer',
                                    })
                                }
                            >
                                Github fork
                            </a>
                        </div>
                    </div>
                </div>
                {canLaunchAsteroids ? (
                    <FooterAsteroidsEasterEgg open={asteroidsOpen} onOpenChange={onAsteroidsOpenChange} tone={tone} />
                ) : (
                    <Link
                        href="/"
                        aria-label={`${SITE_NAME} home`}
                        className="footer-logo-hover-spin inline-flex size-20 shrink-0 items-center justify-center outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95 md:self-start"
                        onClick={() =>
                            trackEvent('nav_link_clicked', {
                                destination: 'home',
                                link_url: '/',
                                source: 'site_footer',
                            })
                        }
                    >
                        <Logo width={80} height={80} />
                    </Link>
                )}
            </footer>
        </>
    );
}
