# Third-Party Licenses

## Vendored Assets

### Fonts

This repository does not vendor third-party font binaries in the source tree.
The repository does not rely on unclear redistribution terms for vendored typography
assets; fonts are loaded at build/runtime rather than committed as binaries.

### Logos and brand marks

The repository vendors token, asset, and provider logo images under
`apps/web/public/logos/` and `apps/admin/public/logos/`. These include
third-party brand marks and trademarks (for example, various tokenized-equity
and protocol/company logos) that are used solely to identify the corresponding
asset or provider within the product UI.

- These logos remain the property of their respective owners and are used for
  identification purposes only. Their inclusion here does not transfer any
  trademark rights or imply endorsement.
- No license is granted for reuse of any third-party logo beyond what the
  respective owner's trademark policy permits. Downstream users of this
  repository are responsible for their own compliance if they redistribute or
  display these marks.
- If you are a rights holder and want a mark removed, open an issue or contact
  the maintainers and it will be removed promptly.

## Dependency Licenses

Third-party package dependencies remain subject to their own licenses as declared in `package.json`, workspace manifests, and the lockfile.

If you add a vendored third-party asset to the repository in the future:

- verify redistribution rights before committing it
- add the relevant attribution or license text here when required
- update `README.md` or release notes if the asset meaningfully affects redistribution posture
