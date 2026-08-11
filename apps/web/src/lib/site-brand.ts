/** Site-wide brand + social config for the SPL Token fork. */

export const SITE_NAME = 'SPL Token';
export const SITE_TICKER = 'SPL';
export const SITE_TOKEN_NAME = 'SPL Token';
export const SITE_LOGO_SRC = '/logos/SPL-Token.svg';

export const SITE_TAGLINE =
    'SPL is Solana’s token standard. Most of what people build are memecoins. $SPL is that truth, tokenized.';

export const SITE_DESCRIPTION =
    'SPL is Solana’s token standard. The official Tokens registry left memecoins out. This fork put them back in the core index. $SPL is that truth, tokenized.';

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
<p>SPL is Solana’s token standard. Everything on-chain follows it, the protocol underneath every asset.</p>
<p>The Solana Foundation open-sourced Tokens, a canonical registry of ~300 verified assets: Bitcoin wrappers, RWAs, institutional money. The “legitimate” layer.</p>
<p>But it was incomplete. Most tokens created on Solana aren’t in that registry. They’re memecoins, tens of thousands of them, the actual heartbeat of the ecosystem. Official infrastructure pretended they didn’t exist.</p>
<p>This fork closed that gap. It added memecoins to the canonical index, not as a side category, as part of the core standard. Because SPL’s real story isn’t only institutional assets. It’s what people actually build. And most people build memes.</p>
<p><strong>$SPL</strong> is the tokenized version of that truth. The standard that finally reflects what Solana actually is.</p>
<p><a href="${SPL_TOKEN_BASICS_URL}" target="_blank" rel="noopener noreferrer">SPL Token basics →</a></p>
`.trim();
