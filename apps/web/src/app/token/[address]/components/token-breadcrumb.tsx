import Link from 'next/link';

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@tokens/ui/breadcrumb';
import { SITE_NAME } from '@/lib/site-brand';

interface TokenBreadcrumbProps {
    displayName: string;
    variantSymbol?: string | null;
    canonicalHref?: string | null;
}

export function TokenBreadcrumb({ displayName, variantSymbol, canonicalHref }: TokenBreadcrumbProps) {
    const trimmedVariantSymbol = (variantSymbol ?? '').trim();
    const shouldShowVariant = trimmedVariantSymbol.length > 0;
    const trimmedCanonicalHref = (canonicalHref ?? '').trim();
    const canLinkCanonical = shouldShowVariant && trimmedCanonicalHref.length > 0;

    return (
        <div className="relative z-10 mt-24">
            <div className="mx-auto max-w-7xl px-6 py-4">
                <Breadcrumb>
                    <BreadcrumbList className="text-body-md">
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link
                                    href="/"
                                    className="flex items-center gap-2 text-text-medium font-medium hover:text-text-extra-high transition-colors group"
                                >
                                    {SITE_NAME}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-text-low" />
                        <BreadcrumbItem>
                            {canLinkCanonical ? (
                                <BreadcrumbLink asChild>
                                    <Link
                                        href={trimmedCanonicalHref}
                                        className="flex items-center gap-2 text-text-medium font-medium hover:text-text-extra-high transition-colors group"
                                    >
                                        {displayName}
                                    </Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage className="text-text-extra-high font-medium">
                                    {displayName}
                                </BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                        {shouldShowVariant ? (
                            <>
                                <BreadcrumbSeparator className="text-text-low" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-text-extra-high font-sans">
                                        ${trimmedVariantSymbol}
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </>
                        ) : null}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
        </div>
    );
}
