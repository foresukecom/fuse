// @ts-check
const { test, expect } = require('./fixtures');

async function openPage(context, name = 'a') {
  const page = await context.newPage();
  await page.goto(`https://example.test/${name}`);
  return page;
}

// Shadow DOM の中の要素は Playwright のロケーターがそのまま辿れる
const timerHost = (page) => page.locator('fuse-timer');
const timerText = (page) => timerHost(page).locator('.display span');

async function startTimer(popup, time) {
  await popup.locator('#timeInput').fill(time);
  await popup.locator('#startTimer').click();
}

test('開始すると、開いている全タブにタイマーが表示される', async ({ context, popup }) => {
  const pageA = await openPage(context, 'a');
  const pageB = await openPage(context, 'b');

  await startTimer(popup, '00:01:00');

  await expect(timerText(pageA)).toHaveText(/^0[01]:[0-9]{2}$/);
  await expect(timerText(pageB)).toHaveText(/^0[01]:[0-9]{2}$/);
});

test('開始後に開いたタブにもタイマーが表示される', async ({ context, popup }) => {
  await startTimer(popup, '00:01:00');
  const page = await openPage(context);
  await expect(timerHost(page)).toHaveCount(1);
});

test('×ボタンで停止すると、すべてのタブから消えて再表示されない', async ({ context, popup }) => {
  const pageA = await openPage(context, 'a');
  const pageB = await openPage(context, 'b');
  await startTimer(popup, '00:01:00');
  await expect(timerHost(pageA)).toHaveCount(1);

  await timerHost(pageA).locator('.close').click();

  await expect(timerHost(pageA)).toHaveCount(0);
  await expect(timerHost(pageB)).toHaveCount(0);
  // 以前は1秒ごとの同期で再表示されていた
  await pageA.waitForTimeout(2000);
  await expect(timerHost(pageA)).toHaveCount(0);
});

test('時間になると完了メッセージが表示され、停止ボタンで消せる', async ({ context, popup }) => {
  const page = await openPage(context);
  await startTimer(popup, '00:00:02');

  await expect(timerText(page)).toHaveText('💥 時間です！', { timeout: 5000 });

  await popup.reload();
  await expect(popup.locator('#status')).toHaveText('時間になりました');
  await popup.locator('#stopTimer').click();
  await expect(timerHost(page)).toHaveCount(0);
});

test('テーマを変えると、開いている全タブに反映される', async ({ context, popup }) => {
  const page = await openPage(context);
  await startTimer(popup, '00:00:03');
  await expect(timerText(page)).toHaveText('💥 時間です！', { timeout: 5000 });

  await popup.locator('#themeSelect').selectOption('ship');

  await expect(timerText(page)).toHaveText('🏝️ 到着しました！');
});

test('ページのスタイルを変更しない', async ({ context, popup }) => {
  const page = await openPage(context);
  await startTimer(popup, '00:01:00');
  await expect(timerHost(page)).toHaveCount(1);

  // 拡張機能のスタイルは Shadow DOM の中だけにあり、ページのスタイルシートは増えない
  expect(await page.evaluate(() => document.styleSheets.length)).toBe(1);
  // ページ側の @keyframes pulse が上書きされていない
  const pulse = await page.evaluate(() => {
    const rule = [...document.styleSheets[0].cssRules].find((r) => r instanceof CSSKeyframesRule && r.name === 'pulse');
    return rule && rule.cssText;
  });
  expect(pulse).toContain('opacity');
});

test('ページのコンソールにログを出さない', async ({ context, popup }) => {
  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  await page.goto('https://example.test/');
  await startTimer(popup, '00:00:02');
  await expect(timerText(page)).toHaveText('💥 時間です！', { timeout: 5000 });
  expect(logs).toEqual([]);
});
