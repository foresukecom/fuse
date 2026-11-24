// テストとスクリーンショット作成で共通の、拡張機能を読み込んだ Chromium の起動処理
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

// `just build` で作った dist/extension/ を読み込む
function extensionPath() {
  return fs.realpathSync(path.join(__dirname, '..', 'dist', 'extension'));
}

// パッケージ化されていない拡張機能のIDは、読み込んだディレクトリの絶対パスから決まる。
// この拡張機能にはサービスワーカーがないため、Playwright の一般的な方法ではIDを取れない
function unpackedExtensionId(dir) {
  const hash = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hash].map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('');
}

async function launchWithExtension(options = {}) {
  const dir = extensionPath();
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    ...options,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  return { context, extensionId: unpackedExtensionId(dir) };
}

module.exports = { launchWithExtension };
