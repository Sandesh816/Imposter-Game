# Multiplayer V2

The shipped interface is the DOM application in `index.js`. React files are not the active homepage. All Firebase clients import the same initialized instances from `firebase-client.js`.

## Authority and data

`roomCommand` uses the authenticated UID, validates phase/role/input and commits a room transaction. Clients cannot write game state. Commands have retry IDs; round actions also carry the current round ID. Random assignments are selected in the service, with the same random stream replayed on transaction retries.

- `roomsV2/{code}/public`: members may read the room's status, roster, readiness and published results. No pre-results roles or secret word appear here.
- `private/{uid}`: only that room member may read their role and permitted word/question. The client combines this with public state only when round IDs match.
- `server`: no client access. Holds assignments, ballots, retry receipts, and disconnect deadlines.
- `members`: service-owned authorization source. Users cannot add themselves with direct writes.
- `connections/{uid}/{connectionId}`: authenticated member may create/remove their own tab connections.
- `chat`: member-only, append-only messages with enforced author, name and bounded text.
- `voiceUsers` and `voiceSignals`: member voice state and recipient-readable signaling inboxes with enforced sender identity.

The `rooms` legacy namespace is closed to clients. Never restore its old broad authenticated permissions.

## Reconnects and departures

Authentication UID identifies a player; local storage keeps only room reference/name/UID. A refreshed tab rejoins its existing membership during an active round. Each tab owns a separate presence connection, with removal registered before setting it online.

Loss of the last connection pauses active play. The service schedules a 60-second deadline. The presence trigger retries failed task scheduling with the original deadline. The task rereads connections and the current deadline before removing anyone, so a stale task cannot remove a reconnected player. Explicit departure skips this grace period.

A non-host departing mid-round cancels it with no points and returns the remaining players to the lobby. A departing host closes the room. A completed result remains completed if it committed before a departure: `results.players` freezes the round roster, names, roles and votes for historical rendering, while the live `public.players` roster controls the next round. A new round requires at least three connected, ready players.

Task queue invocation must stay private. Its runtime service account needs queue-enqueue and function-invocation rights; verify actual delivery in staging.

## Leagues and categories

Creating/joining a cloud league goes through `leagueCommand`. Joining grants membership, never administrator status. Only the owner can grant an existing member administrator status. Existing UI roster management and manual local-game score recording are restricted by rules to the owner/administrators. Score increments use database transactions.

Online round results are computed by the room service. The current interface does not save these results to leagues; manually recorded local-game league scores remain administrator-attested.

Community publishing, votes, and import accounting use `categoryCommand`. Votes and imports are idempotent per UID. Personal categories remain under the user's own UID. Unvalidated client writes to the public community collection are denied.

## Local verification

Use Node 22.12+ within Node 22, Java for the database emulator, and Chromium installed by Playwright. `npm run verify` builds the emulator-configured client, runs unit/integration/browser tests, then checks a production build. Tests always use `demo-imposter-review`; `firebase.test.json` binds its database namespace explicitly.

`/legacy/` redirects to the same bundled application, preventing an unbundled second Firebase configuration from bypassing local test isolation.
