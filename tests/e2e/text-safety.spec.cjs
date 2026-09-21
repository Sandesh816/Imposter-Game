const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const acorn = require('acorn');
// Exercise actual production renderers against a real DOM. Firebase is not needed
// to reproduce a rendering defect: the inputs are the same room snapshots.
const source = fs.readFileSync('index.js', 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function functionSource(name) {
  const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  if (!node) throw new Error(`Missing production function ${name}`);
  return source.slice(node.start, node.end);
}
async function render(page, functions, expression) {
  await page.goto('/');
  const helper = fs.existsSync('ui/safe-text.js') ? fs.readFileSync('ui/safe-text.js', 'utf8').replace(/export /g, '') : '';
  await page.evaluate(({helper, code, expression}) => {
    const elements = new Proxy({}, { get(target, key) {
      if (!target[key]) { target[key] = document.createElement('div'); document.body.append(target[key]); }
      return target[key];
    }});
    const gameState = { myPlayerId: 'me', roomData: { anonymousVoting: false }, selectedVote: null, unreadMessages: 0 };
    const getPlayerAvatars = () => ['🙂'];
    const updateMPImposterLimits = () => {};
    eval(`${helper}\n${code}\n${expression}`);
  }, {helper, code: functions.map(functionSource).join('\n'), expression});
}
test('remote lobby names are literal text', async ({page}) => {
  await render(page, ['updateLobbyUI'], `updateLobbyUI({category:'countries'},false,{me:{name:'<img src=x>',isReady:false}},1)`);
  await expect(page.locator('.lobby-player-name').last()).toHaveText('<img src=x> (You)');
  await expect(page.locator('.lobby-player-name img')).toHaveCount(0);
});
test('chat sender and message cannot execute HTML', async ({page}) => {
  await render(page, ['handleChatUpdate'], `handleChatUpdate([{playerId:'other',playerName:'<img src=x>',text:'<img src=x onerror="window.__textExecuted=true">'}])`);
  await expect(page.locator('.chat-message-text').last()).toHaveText('<img src=x onerror="window.__textExecuted=true">');
  await expect(page.locator('.chat-message img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__textExecuted)).toBeUndefined();
});
test('departed voting card is removed without throwing', async ({page}) => {
  await render(page, ['updateVotingStatus'], `
    elements.votingGrid.innerHTML='<div class="voting-card" data-player-id="gone"></div>';
    gameState.selectedVote='gone';
    updateVotingStatus({players:{me:{name:'Me',vote:null}}});
    if(gameState.selectedVote!==null) throw new Error('Departed target remains selected');
  `);
  await expect(page.locator('.voting-card[data-player-id="gone"]')).toHaveCount(0);
});
