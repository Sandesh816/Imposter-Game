const { test, expect } = require('@playwright/test');
async function guest(browser,baseURL,name){
 const context=await browser.newContext();const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',async dialog=>{if(dialog.type()==='confirm')await dialog.accept();else {errors.push(dialog.message());await dialog.dismiss();}});
 await page.goto(baseURL);await page.locator('#landing-guest-btn').click();
 await expect(page.locator('#welcome-screen')).toHaveClass(/active/);
 await page.locator('#multiplayer-mode-btn').click();
 return {context,page,name,errors};
}
async function setup(browser,baseURL,question=false){
 const players=[];
 for(const name of ['Host','Alice','<img src=x>'])players.push(await guest(browser,baseURL,name));
 const [host,...others]=players;
 await host.page.locator('#create-room-btn').click();
 await host.page.locator('#host-name-input').fill(host.name);
 await host.page.locator('#create-room-submit-btn').click();
 await expect(host.page.locator('#mp-lobby-screen')).toHaveClass(/active/);
 const code=await host.page.locator('#lobby-room-code').textContent();
 for(const player of others){
  await player.page.locator('#join-room-btn').click();
  await player.page.locator('#room-code-input').fill(code.trim());
  await player.page.locator('#join-name-input').fill(player.name);
  await player.page.locator('#join-room-submit-btn').click();
  await expect(player.page.locator('#mp-lobby-screen')).toHaveClass(/active/);
  await player.page.locator('#mp-lobby-ready-btn').click();
 }
 await expect(host.page.locator('#lobby-players-list .lobby-player-name').filter({hasText:'<img src=x>'})).toHaveText('<img src=x>');
 await expect(host.page.locator('#lobby-players-list img')).toHaveCount(0);
 if(question)await host.page.locator('#lobby-game-type-question').click();
 await expect(host.page.locator('#mp-start-game-btn')).toBeEnabled();
 await host.page.locator('#mp-start-game-btn').click();
 for(const player of players)await expect(player.page.locator('#mp-word-screen')).toHaveClass(/active/);
 return players;
}
async function discussion(players,question=false){
 for(const player of players){
  await player.page.locator('#mp-reveal-card').click();
  if(question){await player.page.locator('#mp-answer-input').fill('Rice');await player.page.locator('#mp-submit-answer-btn').click();}
  else {await expect(player.page.locator('#mp-ready-btn')).toBeEnabled();await player.page.locator('#mp-ready-btn').click();}
 }
 for(const player of players)await expect(player.page.locator('#mp-discussion-screen')).toHaveClass(/active/);
}
for(const question of [false,true])test(`${question?'question':'word'} game survives refresh and completes voting`,async({browser,baseURL})=>{
 const players=await setup(browser,baseURL,question);
 try{
  const [,alice]=players;
  await alice.page.reload();
  await expect(alice.page.locator('#mp-word-screen')).toHaveClass(/active/);
  await expect(players[0].page.locator('#lobby-player-count')).toHaveText('3');
  await discussion(players,question);
  await players[0].page.locator('#mp-start-voting-btn').click();
  for(const player of players){await expect(player.page.locator('#mp-voting-screen')).toHaveClass(/active/);await player.page.locator('#skip-vote-btn').click();}
  for(const player of players){await expect(player.page.locator('#mp-results-screen')).toHaveClass(/active/);expect(player.errors).toEqual([]);}
 }finally{await Promise.all(players.map(p=>p.context.close()));}
});
test('leaving during voting cancels the round without an exception',async({browser,baseURL})=>{
 const players=await setup(browser,baseURL);
 try{
  await discussion(players);await players[0].page.locator('#mp-start-voting-btn').click();
  await expect(players[1].page.locator('#mp-voting-screen')).toHaveClass(/active/);
  // The same authenticated player opens another tab, restores their active
  // room, and leaves through the visible navigation control.
  const second=await players[1].context.newPage();await second.goto(baseURL);
  await expect(second.locator('#mp-voting-screen')).toHaveClass(/active/);
  await second.close();
  await expect(players[0].page.locator('#mp-voting-screen')).toHaveClass(/active/);
  await players[1].page.locator('#mp-voting-screen .mp-leave-mid').click();
  await expect(players[0].page.locator('#mp-lobby-screen')).toHaveClass(/active/);
  await expect(players[0].page.locator('#room-status-notice')).toContainText('cancelled without points');
  expect(players[0].errors).toEqual([]);expect(players[2].errors).toEqual([]);
 }finally{await Promise.all(players.map(p=>p.context.close()));}
});
