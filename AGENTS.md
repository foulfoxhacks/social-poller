# Social Poller change discipline

- This is the independent social-poller Worker repository. Source is in src/.
- Work on main unless the owner requests a branch. Record changes in CHANGELOG.md.
- No platform credentials, imported private payloads, IP addresses or browser state in Git.
- Accept only explicit platform/username inputs. Never turn lookup into an arbitrary-URL proxy.
- Verify profile identity. Preserve source, precision, metric scope and observation time.
- Unknown values are null, not zero. Errors must not make old values look current.
- No login, CAPTCHA, paywall or anti-bot circumvention. Public-page adapters require permission and crawler-policy checks.
- General searches must never expose another creator's private analytics.
- Run npm test, npm run check and npm run build before deployment; verify live API and UI afterward.
- Preserve the creator site's canonical routes, rendered content and indexability when integrating.
