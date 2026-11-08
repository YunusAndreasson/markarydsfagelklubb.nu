# Security policy

The site shares its database with the club's app, where members' accounts,
reports, photos and phone numbers live, and its Worker holds a key that can
read all of it. A hole here could expose members' data or let someone change
the club's pages. Please report one privately.

## Reporting a vulnerability

Use GitHub's private reporting:
[report a vulnerability](https://github.com/YunusAndreasson/markarydsfagelklubb.nu/security/advisories/new).
Please don't open a public issue.

Include the URL, what you did, what happened, and what an attacker would gain.
Real members' data is on the other side of this site, so stop at the first
proof: don't read more of it than you need to show the problem, and don't
change or delete anything that isn't yours. A fix is coordinated with you
before anything is published, and you're credited in the advisory unless
you'd rather not be.

## Supported versions

There are no releases. The deployed site, built from `main`, is the only
version, and fixes ship to it.

## Scope

In scope:

- the site at https://mafk-web.jonas-268.workers.dev, including `/admin`
- what the larm pages publish about members and their reports
- the tables, policies and storage buckets in `supabase/migrations/`
- this repository's workflows

Out of scope: the WordPress site still running at markarydsfagelklubb.nu
(the club's host runs it until the domain moves), the
[app](https://github.com/YunusAndreasson/markarydsfagelklubb/security/advisories/new),
which has its own reporting, and Supabase, Cloudflare and Artportalen
themselves. Report those to their owners.
