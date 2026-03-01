const { test, expect } = require('@playwright/test');

const APP_TIMEOUT = 120000;

function activeScreen(page) {
  return page.locator('.screen.active');
}

async function isVisible(locator, timeout = 5000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function continueAsGuest(page, baseURL) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  const guestBtn = page.getByRole('button', { name: /Continue as Guest/i });
  if (await isVisible(guestBtn, 8000)) {
    await guestBtn.click();
  }

  await expect(page.getByRole('button', { name: /Multiplayer/i })).toBeVisible({ timeout: APP_TIMEOUT });
}

async function openMultiplayerHome(page) {
  await page.getByRole('button', { name: /Multiplayer/i }).click();
  await expect(activeScreen(page).getByRole('heading', { name: /Multiplayer/i })).toBeVisible({ timeout: APP_TIMEOUT });
}

async function createRoom(page, playerName) {
  await openMultiplayerHome(page);
  await activeScreen(page).getByRole('button', { name: /Create Room/i }).first().click();
  await expect(activeScreen(page).getByRole('heading', { name: /Create Room/i })).toBeVisible({ timeout: APP_TIMEOUT });

  await activeScreen(page).locator('input[placeholder="Enter your name"]').fill(playerName);
  await activeScreen(page).getByRole('button', { name: /Create Room/i }).click();
  await expect(activeScreen(page).getByRole('heading', { name: /Lobby/i })).toBeVisible({ timeout: APP_TIMEOUT });
}

async function readRoomCode(page) {
  await expect(activeScreen(page).locator('.room-code-value')).toBeVisible({ timeout: APP_TIMEOUT });
  const codeText = (await activeScreen(page).locator('.room-code-value').textContent())?.trim() || '';
  const code = codeText.match(/[A-Z2-9]{6}/)?.[0] || '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  return code;
}

async function joinRoom(page, roomCode, playerName) {
  await openMultiplayerHome(page);
  await activeScreen(page).getByRole('button', { name: /Join Room/i }).first().click();
  await expect(activeScreen(page).getByRole('heading', { name: /Join Room/i })).toBeVisible({ timeout: APP_TIMEOUT });

  await activeScreen(page).locator('input[placeholder="XXXXXX"]').fill(roomCode);
  await activeScreen(page).locator('input[placeholder="Enter your name"]').fill(playerName);
  await activeScreen(page).getByRole('button', { name: /Join Room/i }).click();
  await expect(activeScreen(page).getByRole('heading', { name: /Lobby/i })).toBeVisible({ timeout: APP_TIMEOUT });
}

async function setLobbyReady(page) {
  const readyBtn = activeScreen(page).getByRole('button', { name: /^I'm Ready$/ });
  await expect(readyBtn).toBeVisible({ timeout: APP_TIMEOUT });
  await readyBtn.click();
  await expect(activeScreen(page).getByRole('button', { name: /^Ready!$/ })).toBeVisible({ timeout: APP_TIMEOUT });
}

async function revealAndReady(page) {
  await expect(activeScreen(page).getByRole('heading', { name: /Your Role/i })).toBeVisible({ timeout: APP_TIMEOUT });
  await activeScreen(page).locator('.reveal-card').click();
  const readyBtn = activeScreen(page).getByRole('button', { name: /Ready for Discussion/i });
  await expect(readyBtn).toBeEnabled({ timeout: APP_TIMEOUT });
  await readyBtn.click();
}

async function openChat(page) {
  await expect(page.getByRole('button', { name: 'Toggle chat' })).toBeVisible({ timeout: APP_TIMEOUT });
  await page.getByRole('button', { name: 'Toggle chat' }).click();
  await expect(page.locator('.chat-input')).toBeVisible({ timeout: APP_TIMEOUT });
}

async function closeChat(page) {
  try {
    const chatOverlay = page.locator('.chat-overlay.active');
    if (await isVisible(chatOverlay, 1500)) {
      await chatOverlay.click({ force: true });
      return;
    }
    const closeBtn = page.getByRole('button', { name: 'Close chat' });
    if (await isVisible(closeBtn, 1500)) {
      await closeBtn.click({ force: true });
    }
  } catch {
    // best-effort close
  }
}

async function sendChat(page, message) {
  await openChat(page);
  await page.locator('.chat-input').fill(message);
  await page.locator('.chat-input').press('Enter');
  await expect(page.locator('.chat-message-text', { hasText: message })).toBeVisible({ timeout: APP_TIMEOUT });
  await closeChat(page);
}

async function expectChatMessage(page, message) {
  await openChat(page);
  await expect(page.locator('.chat-message-text', { hasText: message })).toBeVisible({ timeout: APP_TIMEOUT });
  await closeChat(page);
}

async function castVote(page, targetName) {
  const voteCard = activeScreen(page).locator('.voting-card', { hasText: targetName }).first();
  await expect(voteCard).toBeVisible({ timeout: APP_TIMEOUT });
  await voteCard.click();
  const submitBtn = activeScreen(page).getByRole('button', { name: /^Submit Vote$/ });
  await submitBtn.click();
  await expect(submitBtn).toBeDisabled({ timeout: APP_TIMEOUT });
}

async function waitForVoteCount(page, voted, total) {
  const resultsHeading = activeScreen(page).locator('.results-header h2');
  if (await isVisible(resultsHeading, 1200)) {
    return;
  }
  await expect(activeScreen(page).locator('.voting-status')).toContainText(new RegExp(`\\b${voted}\\b\\s*of\\s*\\b${total}\\b`), {
    timeout: APP_TIMEOUT,
  });
}

async function waitForResults(page) {
  await expect(activeScreen(page).locator('.results-header h2')).toBeVisible({ timeout: APP_TIMEOUT });
}

async function leaveRoomIfPossible(page) {
  try {
    const chatOverlay = page.locator('.chat-overlay.active');
    if (await isVisible(chatOverlay, 800)) {
      await chatOverlay.click({ force: true });
    }

    const leaveBtn = activeScreen(page).getByRole('button', { name: /Leave Room/i }).first();
    if (await isVisible(leaveBtn, 3000)) {
      await leaveBtn.click({ force: true });
    }
  } catch {
    // best-effort cleanup only
  }
}

test.describe('Phase 3 - deployed multiplayer flow', () => {
  test.setTimeout(300000);

  test('host and players can finish a full online round with chat and leaderboard', async ({ browser, baseURL }) => {
    const runSuffix = `${Date.now()}`.slice(-6);
    const names = {
      host: `Host${runSuffix}`,
      p2: `Alex${runSuffix}`,
      p3: `Sam${runSuffix}`,
    };

    const hostContext = await browser.newContext();
    const player2Context = await browser.newContext();
    const player3Context = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const player2Page = await player2Context.newPage();
    const player3Page = await player3Context.newPage();

    try {
      await Promise.all([
        continueAsGuest(hostPage, baseURL),
        continueAsGuest(player2Page, baseURL),
        continueAsGuest(player3Page, baseURL),
      ]);

      await createRoom(hostPage, names.host);
      const roomCode = await readRoomCode(hostPage);

      await Promise.all([
        joinRoom(player2Page, roomCode, names.p2),
        joinRoom(player3Page, roomCode, names.p3),
      ]);

      await expect(activeScreen(hostPage)).toContainText(names.p2, { timeout: APP_TIMEOUT });
      await expect(activeScreen(hostPage)).toContainText(names.p3, { timeout: APP_TIMEOUT });

      await Promise.all([
        setLobbyReady(player2Page),
        setLobbyReady(player3Page),
      ]);

      const startBtn = activeScreen(hostPage).getByRole('button', { name: /Start Game|Play/i });
      await expect(startBtn).toBeEnabled({ timeout: APP_TIMEOUT });
      await startBtn.click();

      await Promise.all([
        revealAndReady(hostPage),
        revealAndReady(player2Page),
        revealAndReady(player3Page),
      ]);

      await Promise.all([
        expect(activeScreen(hostPage).getByRole('heading', { name: /Discussion Time!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
        expect(activeScreen(player2Page).getByRole('heading', { name: /Discussion Time!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
        expect(activeScreen(player3Page).getByRole('heading', { name: /Discussion Time!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
      ]);

      const chatMessage = `phase3-e2e-${Date.now()}`;
      await sendChat(hostPage, chatMessage);
      await expectChatMessage(player2Page, chatMessage);

      await activeScreen(hostPage).getByRole('button', { name: /^Start Voting$/ }).click();

      await Promise.all([
        expect(activeScreen(hostPage).getByRole('heading', { name: /Vote!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
        expect(activeScreen(player2Page).getByRole('heading', { name: /Vote!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
        expect(activeScreen(player3Page).getByRole('heading', { name: /Vote!/i })).toBeVisible({ timeout: APP_TIMEOUT }),
      ]);

      await castVote(hostPage, names.p2);
      await waitForVoteCount(hostPage, 1, 3);
      await castVote(player2Page, names.host);
      await waitForVoteCount(hostPage, 2, 3);
      await castVote(player3Page, names.host);
      await waitForVoteCount(hostPage, 3, 3);

      await waitForResults(hostPage);
      await waitForResults(player2Page);

      await expect(activeScreen(hostPage)).toContainText('Room Leaderboard', { timeout: APP_TIMEOUT });
      await expect(activeScreen(hostPage).locator('.room-leaderboard-row')).toHaveCount(3, { timeout: APP_TIMEOUT });
      await expect(activeScreen(hostPage)).toContainText(names.host);
      await expect(activeScreen(hostPage)).toContainText(names.p2);
      await expect(activeScreen(hostPage)).toContainText(names.p3);
    } finally {
      await leaveRoomIfPossible(hostPage);
      await Promise.all([
        hostContext.close(),
        player2Context.close(),
        player3Context.close(),
      ]);
    }
  });
});
