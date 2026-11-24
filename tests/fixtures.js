// @ts-check
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { test: base, chromium } = require('@playwright/test');

// `just build` で作った dist/extension/ を読み込む（`just test` が先にビルドする）
const extensionPath = fs.realpathSync(path.join(__dirname, '..', 'dist', 'extension'));

// パッケージ化されていない拡張機能のIDは、読み込んだディレクトリの絶対パスから決まる。
// この拡張機能にはサービスワーカーがないため、Playwright の一般的な方法ではIDを取れない
function unpackedExtensionId(dir) {
  const hash = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hash].map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('');
}

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    // 外部に通信せず、固定のHTMLを返す。ページ自身も @keyframes pulse を定義しておき、
    // 拡張機能がページのスタイルに影響しないことを確かめられるようにする
    await context.route('https://example.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><title>test</title>
          <style>@keyframes pulse { 50% { opacity: .5; } }</style>
          <body><p>test</p></body>`,
      }),
    );
    await use(context);
    await context.close();
  },
  extensionId: async ({}, use) => {
    await use(unpackedExtensionId(extensionPath));
  },
  // ポップアップを通常のタブとして開く
  popup: async ({ context, extensionId }, use) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(popup);
  },
});

module.exports = { test, expect: test.expect };
