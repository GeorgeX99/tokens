import Image from 'next/image';
import { memo } from 'react';
import { cn } from '@tokens/ui/cn';

import { SITE_LOGO_SRC, SITE_NAME } from '@/lib/site-brand';

interface LogoProps {
    className?: string;
    width?: number;
    height?: number;
}

const Logo = memo(({ className, width = 24, height = 24 }: LogoProps) => {
    return (
        <Image
            src={SITE_LOGO_SRC}
            alt={SITE_NAME}
            width={width}
            height={height}
            className={cn('object-contain', className)}
        />
    );
});

Logo.displayName = 'Logo';

export { Logo };
