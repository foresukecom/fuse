// @ts-check
const { test: base } = require('@playwright/test');
const { launchWithExtension } = require('../scripts/extension');

// `just test` が先にビルドした dist/extension/ を読み込む
const test = base.extend({
  launched: async ({}, use) => {
    const launched = await launchWithExtension();
    // 外部に通信せず、固定のHTMLを返す。ページ自身も @keyframes pulse を定義しておき、
    // 拡張機能がページのスタイルに影響しないことを確かめられるようにする
    await launched.context.route('https://example.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><title>test</title>
          <style>@keyframes pulse { 50% { opacity: .5; } }</style>
          <body><p>test</p></body>`,
      }),
    );
    await use(launched);
    await launched.context.close();
  },
  context: async ({ launched }, use) => {
    await use(launched.context);
  },
  extensionId: async ({ launched }, use) => {
    await use(launched.extensionId);
  },
  // ポップアップを通常のタブとして開く
  popup: async ({ context, extensionId }, use) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(popup);
  },
});

module.exports = { test, expect: test.expect };
