'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconXLogo } from 'symbols-react';
import { cn } from '@tokens/ui/cn';
import { trackEvent } from '@/lib/posthog-client';
import {
    getSiteXUrl,
    SPL_TOKEN_BASICS_URL,
} from '@/lib/site-brand';
import { HeaderSolPrice } from './header-sol-price';
import { HeaderSplPrice } from './header-spl-price';
import { TokenSearch } from './token-search';
import { useSearchVisibility } from './search-visibility-provider';

function getHasScrolled(): boolean {
    return window.scrollY > 0;
}

function shouldHideGlobalHeader(pathname: string): boolean {
    // Routes that render their own page-scoped nav and want the global header hidden.
    return (
        pathname === '/assets-api' ||
        pathname.startsWith('/assets-api/') ||
        pathname === '/partners' ||
        pathname.startsWith('/partners/')
    );
}

export function Header() {
    const pathname = usePathname();
    const { isHeroSearchVisible } = useSearchVisibility();
    const [hasScrolled, setHasScrolled] = useState(false);
    const xUrl = getSiteXUrl();

    useEffect(() => {
        function handleScroll() {
            const nextHasScrolled = getHasScrolled();
            setHasScrolled(prevHasScrolled =>
                prevHasScrolled === nextHasScrolled ? prevHasScrolled : nextHasScrolled,
            );
        }

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (pathname && shouldHideGlobalHeader(pathname)) return null;

    return (
        <header
            className={cn(
                'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200',
                hasScrolled
                    ? 'bg-background/70 backdrop-blur-sm border-border-light/70'
                    : 'bg-transparent border-transparent',
            )}
        >
            <div className="mx-auto flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <Link
                        href="/"
                        className="inline-flex h-10 items-center px-2 text-[length:var(--text-button-lg)] font-semibold leading-none text-text-medium transition-colors duration-150 hover:text-text-extra-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() =>
                            trackEvent('nav_link_clicked', {
                                destination: 'home',
                                link_url: '/',
                                source: 'header',
                            })
                        }
                    >
                        Home
                    </Link>
                    <div className="hidden items-center gap-2 md:flex">
                        <HeaderSolPrice />
                        <HeaderSplPrice />
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-end gap-2 sm:justify-center sm:gap-3">
                    <div
                        className={`transition-[opacity,transform] duration-200 ease-out ${
                            isHeroSearchVisible
                                ? 'opacity-0 pointer-events-none translate-y-1'
                                : 'opacity-100 pointer-events-auto translate-y-0'
                        }`}
                    >
                        <TokenSearch />
                    </div>
                    <div className="flex items-center gap-2 md:hidden">
                        <HeaderSolPrice />
                        <HeaderSplPrice />
                    </div>
                </div>

                <nav aria-label="Main navigation" className="hidden items-center gap-3 sm:flex lg:gap-5">
                    <Link
                        href="/#memecoins"
                        className="inline-flex h-10 items-center px-2 text-[length:var(--text-button-lg)] font-semibold leading-none text-text-medium transition-colors duration-150 hover:text-text-extra-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() =>
                            trackEvent('nav_link_clicked', {
                                destination: 'memecoins',
                                link_url: '/#memecoins',
                                source: 'header',
                            })
                        }
                    >
                        Memecoins
                    </Link>
                    <a
                        href={SPL_TOKEN_BASICS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden lg:inline-flex h-10 items-center px-2 text-[length:var(--text-button-lg)] font-semibold leading-none text-text-medium transition-colors duration-150 hover:text-text-extra-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() =>
                            trackEvent('external_link_clicked', {
                                link_type: 'docs',
                                link_url: SPL_TOKEN_BASICS_URL,
                                source: 'header',
                            })
                        }
                    >
                        Basics
                    </a>
                    <a
                        href={xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="SPL Token on X"
                        className="inline-flex size-9 items-center justify-center rounded-full bg-text-extra-high text-background transition-[colors,transform] duration-150 hover:bg-text-high active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() =>
                            trackEvent('external_link_clicked', {
                                link_type: 'x',
                                link_url: xUrl,
                                source: 'header',
                            })
                        }
                    >
                        <IconXLogo className="size-4 fill-current" aria-hidden="true" />
                    </a>
                </nav>
            </div>
        </header>
    );
}
