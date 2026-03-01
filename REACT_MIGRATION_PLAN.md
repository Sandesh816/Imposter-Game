# React Migration Plan (Safe / No-Regression)

## Goal
Move all game logic and UI to React without breaking existing behavior.

## Safety Rules
- Keep legacy flow runnable until each React feature reaches parity.
- Migrate one feature slice at a time.
- Ship behind a feature flag during migration.
- Verify parity after each slice before removing legacy code.

## Migration Slices
1. Core game engine (round generation, imposter assignment, word/question selection)
2. Local mode UI + state in React
3. Multiplayer UI + state in React
4. League and custom category flows in React
5. Auth/profile flow in React
6. Remove legacy DOM-driven entry

## Definition Of Done Per Slice
- Existing behavior is preserved.
- No feature removed.
- Build passes (`npm run build`).
- Manual smoke pass: local game, multiplayer room create/join, voting, results.

## Current Status
- React app shell is active.
- Core local round logic extracted to shared engine:
  - `gameEngine.js`
- Legacy app now uses extracted engine for round creation.
- React hook scaffold created for local game state:
  - `src/react-game/useLocalGameEngine.js`
- Phase 2 local flow is implemented in React behind a safety flag:
  - Add `?reactLocal=1` to the URL
  - File: `src/react-game/LocalModeApp.jsx`
  - Covers: game type, players, categories, reveal flow, local vote/results modal
- Phase 3 multiplayer flow is implemented in React behind the same safety flag:
  - `?reactLocal=1`
  - File: `src/react-game/LocalModeApp.jsx`
  - Covers: create/join, lobby, category picker, reveal/ready, discussion, voting, results, new round
- Multiplayer parity polish is now added in React:
  - `?reactLocal=1`
  - File: `src/react-game/LocalModeApp.jsx`
  - Covers: room chat sidebar, anonymous voting toggles (lobby/results), live vote feed behavior for anonymous vs non-anonymous mode
- Phase 4 league flow is now implemented in React:
  - File: `src/react-game/LocalModeApp.jsx`
  - Covers: league hub, create/join, detail/standings, play mode, league player selection, local and multiplayer league point saving
- Phase 5 auth/profile + custom category/community flow is now implemented in React:
  - File: `src/react-game/LocalModeApp.jsx`
  - Covers: onboarding (guest/google), welcome auth chip, profile management, category create/edit/publish, community browse/upvote/import
- Phase 6 entry flip is implemented:
  - File: `src/App.jsx`
  - React is now the default app entry
  - Legacy app remains available as a safety fallback with `?legacy=1`
- Remaining migration work:
  - Legacy decommission cleanup (optional, after confidence window)
