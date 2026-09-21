# Secret Word Imposter Game

A fun party game where players get a secret word, except for the imposter(s) who get a different message. Players must discuss and figure out who the imposter is!

## How to Play

1. **Add Players**: Add all players who will be playing (minimum 3)
2. **Choose Category**: Select from 15+ categories like Countries, Celebrities, Sports, and more
3. **Pass the Phone**: Each player privately reveals their word, then hides it before passing
4. **Discuss**: Players discuss the topic without directly saying their word
5. **Vote**: Find and vote out the imposter!

## Features

- 🎮 15+ categories with extensive word lists
- 👥 Support for any number of players (3+)
- 🕵️ Configurable number of imposters
- 📱 Mobile-first responsive design
- ✨ Premium dark theme with animations

## Local Development

Use Node 22.12+ (Node 22), Java for Firebase emulators, and the bundled Vite application. Opening source HTML directly is no longer supported.

```bash
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run verify
```

`npm run verify` runs unit tests, isolated Auth/Database/Functions integration tests, and real Chromium games against a build of the current checkout. It finishes with a separate production build and checks its configuration. It never runs against the deployed game.

For frontend development, use `npm run dev`. Normal builds use `firebase-config.js`; use an owner-controlled development project, or explicitly select the emulators with `VITE_USE_EMULATORS=1 VITE_FIREBASE_PROJECT_ID=demo-imposter-review npm run dev` while the emulators are running.

The current homepage is the DOM-based `index.js` interface. `/legacy/` redirects to that same bundled application. The React migration remains unfinished.

## Firebase Deployment

This version requires a coordinated Functions, rules, and client deployment. Read [the release runbook](docs/release-security-fixes.md) before changing a live project. Online room commands are disabled in production until the owner enables `serverConfig/multiplayerEnabled` after verifying the deployment.

[Multiplayer V2](docs/multiplayer-v2.md) documents private roles, UID membership, reconnect deadlines, and league permissions. Existing league data requires a reviewed ownership migration; do not delete it or preserve the old automatic admin grants blindly.

## CI Gate

GitHub Actions runs `npm run verify` against the same checkout and uploads the verified production web artifact. It does not deploy Hosting alone: release requires the matching backend/rules and the staging checks in the runbook.

## Categories Included

- 🌍 Countries (100+)
- ⭐ Celebrities
- ⚔️ Clash Royale Cards
- ⚽ Soccer Players
- 🏀 Basketball Players
- 🏏 Cricket Players
- 🏆 Athletes (General)
- 🏢 Companies
- 🎬 Movies
- 🍕 Foods
- 🦁 Animals
- 🎮 Video Games
- 📺 TV Shows
- 🎵 Musical Artists
- 🏅 Sports Teams

## License

MIT
