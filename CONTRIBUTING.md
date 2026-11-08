# Contributing

Bug reports and pull requests are welcome. For anything bigger than a fix,
open an issue first, so we can agree on the shape before you write the code.
The site is the club's, so a change to what visitors see may need the club's
say as well.

## Build and check

You need Node 22.12 or newer and pnpm 11. `pnpm install`, then `pnpm dev`
serves the site at http://localhost:4321 from the club's live database, read
with the public key; [CLAUDE.md](CLAUDE.md) has the conventions.

Before a pull request:

- `pnpm verify` passes: Biome, `astro check`, Vitest and the build. CI runs
  the same command.
- For anything visible, or anything about headers or redirects, look at it in
  `pnpm preview`, which serves the build from the real Worker.
- One change per pull request, with a commit message in the repository's
  style: a short sentence in the imperative, such as "Shorten the programme
  page's intro".

## What the site won't do

Some behaviour is deliberate and changes to it need a strong case:

- A larm's place is never published as a coordinate, and a member's name is
  never read from the alert log, only from their live profile.
- Members don't sign in on the website; the one login is the administrator's.
- Public pages send no JavaScript beyond the map's.
- CI never deploys and never migrates. The database is shared with the live
  app, so schema changes are applied by hand, after reading
  [docs/shared-database.md](docs/shared-database.md).
- The site's copy is Swedish, with no English fallbacks.

## Security issues

Not in issues or pull requests: see [SECURITY.md](SECURITY.md).

## Conduct and license

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
contributing, you agree your code is released under the
[MIT license](LICENSE); the club's texts, emblem and photos are not part of
that grant.
