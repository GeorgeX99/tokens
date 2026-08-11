/** Site-wide brand + social config for the SPL Token fork. */

export const SITE_NAME = 'SPL Token';
export const SITE_TICKER = 'SPL';
export const SITE_TOKEN_NAME = 'SPL Token';
export const SITE_TITLE = 'SPL | The heartbeat of Solana';
export const SITE_LOGO_SRC = '/logos/SPL-Token.svg';

export const SITE_TAGLINE =
    'SPL is Solana’s token standard. Most of what people build are memecoins. $SPL is that truth, tokenized.';

export const SITE_DESCRIPTION =
    'SPL is Solana’s token standard. The official Tokens registry left memecoins out. This fork put them back in the core index. $SPL is that truth, tokenized.';

/**
 * Next only inlines `NEXT_PUBLIC_*` when accessed as a static property
 * (`process.env.NEXT_PUBLIC_FOO`). Dynamic `process.env[key]` works on the
 * server but is empty in the client bundle, which hydrates away UI gated on
 * these values (e.g. the header X link).
 */
function readPublicEnv(value: string | undefined): string {
    return (value ?? '').trim();
}

/** Optional mint once the memecoin is deployed. */
export function getSplMint(): string | null {
    const mint = readPublicEnv(process.env.NEXT_PUBLIC_SPL_MINT);
    return mint.length > 0 ? mint : null;
}

/** `NEXT_PUBLIC_X_URL` */
export function getSiteXUrl(): string {
    return readPublicEnv(process.env.NEXT_PUBLIC_X_URL);
}

/** `NEXT_PUBLIC_FORK_URL` — this project’s GitHub repo. */
export function getSiteForkUrl(): string {
    return readPublicEnv(process.env.NEXT_PUBLIC_FORK_URL);
}

/** `NEXT_PUBLIC_UPSTREAM_URL` — repo this project was forked from. */
export function getUpstreamRepoUrl(): string {
    return readPublicEnv(process.env.NEXT_PUBLIC_UPSTREAM_URL);
}

/** `owner/repo` slug from `NEXT_PUBLIC_UPSTREAM_URL`, when set. */
export function getUpstreamRepoSlug(): string {
    const url = getUpstreamRepoUrl();
    if (!url) return '';
    try {
        return new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    } catch {
        return '';
    }
}

/** Badge copy for the fork attribution, e.g. "Forked from solana-foundation/tokens". */
export function getForkedFromLabel(): string {
    const slug = getUpstreamRepoSlug();
    return slug ? `Forked from ${slug}` : 'Forked from upstream';
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
