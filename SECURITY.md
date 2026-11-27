# Security

## Reporting a problem

Please report security problems privately, not in a public issue:

- **GitHub:** use "Report a vulnerability" on the [Security tab](https://github.com/youasked/youasked/security/advisories/new) of this repository.
- **Email:** hello@youasked.dev, with "Security" in the subject.

Include what you found, where (file and line, or the request), and how to reproduce it if you can. We read every report, reply as soon as we can, and fix confirmed problems in the hosted service first, then here.

## Scope

- The hosted API and dashboard (`api.youasked.dev`, `youasked.dev`), whose code is under `apps/`.
- The SDKs and widget under `packages/`.

Please don't test against other people's apps or data, run denial of service tests, or send spam through the feedback forms. Testing against an app you made on a free account is fine.

## Rewards

We don't run a paid bug bounty programme and don't pay for reports. If you'd like to be credited for a confirmed report, tell us the name to use and we'll mention it in the fix.

## Supported versions

Only the hosted service as it runs today and the latest published SDK versions get security fixes.
