# Coordinated security release

This branch changes the client, database rules, and introduces Firebase Functions. Hosting-only deployment is not sufficient. Do not apply it to the live project before staging validation and owner access are available.

## Before release

1. Obtain the repository owner's Firebase deployment access. Confirm Functions/Cloud Tasks support, runtime IAM, and billing configuration. No credentials belong in the repository.
2. Run `npm ci`, `npm ci --prefix functions`, `npx playwright install chromium`, and `npm run verify`.
3. Deploy to an owner-controlled staging project. The tracked production `firebase-config.js` must be replaced with staging configuration for that build. Confirm guest/Google login, word/question modes, custom categories, reconnect, explicit leave, task delivery after 60 seconds, chat, and voice between separate devices.
4. Back up the existing database. Inventory leagues with their `createdBy` and administrators. Old joiners were automatically promoted, so do not blindly preserve those admin grants. Preserve scores/rosters and approve only known administrators. Anonymous/missing owners remain read-only until ownership is recovered. No automatic destructive migration is provided.
5. For each reviewed legacy league, set `version: 2`, preserve the verified `createdBy`, assign reviewed `admins`, and build `members` from legitimate memberships. Review and apply this through an owner-controlled migration, with a saved before/after diff. Client writes to legacy unreviewed leagues stay blocked.

## Cutover

1. Announce a short multiplayer maintenance window. Old active rounds must end; their secrets were readable under the old rules and cannot be recovered into private rounds.
2. Deploy backend support with `serverConfig/multiplayerEnabled` unset or false. This blocks production room commands while deployment is incomplete. The emulator bypass is tied to the Functions emulator environment, not to a request parameter.
3. Deploy restrictive database rules and the matching client in the same maintenance window. Build server category data with `npm run build:server` before Functions deployment. `firebase.json` includes this predeploy step.
4. Verify task queue IAM: only the runtime service account may enqueue/invoke `settleDisconnected`; the task function must not be public. Verify delivery and retry behavior in staging and a dedicated production test room.
5. Set `serverConfig/multiplayerEnabled: true` using owner/admin access. Use dedicated test accounts to verify a real complete round, outsider denial, private-role isolation, reconnect and timeout. Record client/backend/rules versions before reopening the site.

## Recovery

Keep restrictive rules in place. If backend checks fail, set `serverConfig/multiplayerEnabled: false` and keep local pass-and-play available while rolling forward or restoring a V2-compatible client/backend pair. Never restore the old permissive rules or deploy the old client against the new rules and call that a functioning rollback.

A successful local test suite does not establish production deployment, correct production IAM, or real-device audio connectivity. Those require the owner's staging/live access. No production data was changed during implementation.
