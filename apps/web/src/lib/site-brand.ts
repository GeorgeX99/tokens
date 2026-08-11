/** Site-wide brand + social config for the SPL Token fork. */

export const SITE_NAME = 'SPL Token';
export const SITE_TICKER = 'SPL';
export const SITE_TOKEN_NAME = 'SPL Token';
export const SITE_LOGO_SRC = '/logos/SPL-Token.svg';

export const SITE_TAGLINE =
    'Everything on Solana is an SPL Token. Most of it is memecoins. $SPL is the default.';

export const SITE_DESCRIPTION =
    'Every tradeable asset on Solana is an SPL Token. Most new ones are memecoins. $SPL is the default finally getting its shot.';

/** Optional mint once the memecoin is deployed. */
export function getSplMint(): string | null {
    const mint = (process.env.NEXT_PUBLIC_SPL_MINT ?? '').trim();
    return mint.length > 0 ? mint : null;
}

export function getSiteXUrl(): string {
    return (process.env.NEXT_PUBLIC_X_URL ?? 'https://x.com/SPLToken').trim();
}

export function getSiteForkUrl(): string {
    return (process.env.NEXT_PUBLIC_FORK_URL ?? 'https://github.com/GeorgeX99/tokens').trim();
}

export function getUpstreamRepoUrl(): string {
    return (
        process.env.NEXT_PUBLIC_UPSTREAM_URL ?? 'https://github.com/solana-foundation/tokens'
    ).trim();
}

export const SPL_TOKEN_BASICS_URL = 'https://solana.com/docs/tokens/basics';

/** Lore for the About sidebar. HTML allowed (sanitized by ExpandableText). */
export const SPL_ABOUT_HTML = `
<p>Every tradeable asset on Solana is an SPL Token underneath. Bitcoin wrappers, RWAs, stables, memes: same standard.</p>
<p>Most new mints are memecoins. That is the culture. Official Solana surfaces rarely lead with it.</p>
<p>Recently the Solana Foundation open sourced Tokens, a canonical index of ~300 verified assets. That stack was forked, emptied, and pointed at one mint: <strong>$SPL</strong>.</p>
<p>So $SPL is the default name for what Solana already is. The long tail stays live beside it as a Solana memecoin board.</p>
<p><a href="${SPL_TOKEN_BASICS_URL}" target="_blank" rel="noopener noreferrer">SPL Token basics →</a></p>
`.trim();
