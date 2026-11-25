// ストア用スクリーンショット（1280x800）を store/ に作成する。
// 拡張機能を読み込んだ Chromium でスライド風のページを開き、実際に表示された導火線ごと撮影する
const fs = require('fs');
const path = require('path');
const { launchWithExtension } = require('./extension');

const storeDir = path.join(__dirname, '..', 'store');
const template = fs.readFileSync(path.join(storeDir, 'slide.html'), 'utf8');

const shots = [
  {
    file: 'screenshot-1.png',
    theme: 'bomb',
    progress: 0.55,
    eyebrow: 'FUSE',
    title: '残り時間を、<br>燃えていく導火線で。',
    body: 'プレゼンや勉強会の持ち時間を、画面の下でさりげなく知らせます。',
  },
  {
    file: 'screenshot-2.png',
    theme: 'bomb',
    // ポップアップの初期値（5分）に合わせ、開始直後の状態にする
    total: 5 * 60,
    progress: 0.03,
    eyebrow: 'かんたん設定',
    title: '時間を入れて、<br>スタートするだけ。',
    body: 'ツールバーのアイコンから時間を設定します。タイマーは開いているすべてのタブに表示されます。',
    popup: true,
  },
  {
    file: 'screenshot-3.png',
    theme: 'dog',
    progress: 0.4,
    eyebrow: '3つのテーマ',
    title: '爆弾・犬と家・船と島。',
    body: '気分に合わせてテーマを選べます。タイマーの実行中でも切り替えられます。',
  },
  {
    file: 'screenshot-4.png',
    theme: 'ship',
    complete: true,
    eyebrow: '時間になったら',
    title: '終わりの合図も、<br>ひと目で分かる。',
    body: '時間になると完了メッセージが表示され、止めるまで残ります。',
  },
];

const TOTAL_SECONDS = 15 * 60;

function renderSlide(shot, index, popupImage) {
  const aside = shot.popup
    ? `<div class="aside"><img src="data:image/png;base64,${popupImage}" width="510" alt=""></div>`
    : '';
  return template
    .replaceAll('{{title}}', shot.title)
    .replace('{{eyebrow}}', shot.eyebrow)
    .replace('{{body}}', shot.body)
    .replace('{{page}}', `${index + 1} / ${shots.length}`)
    .replace('{{aside}}', aside);
}

// ポップアップは拡大して載せるため、2倍の解像度で撮っておく
async function capturePopup() {
  const { context, extensionId } = await launchWithExtension({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setViewportSize({ width: 340, height: 400 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // body の高さを超えて中身が描画されているため、中身の下端に合わせて切り取る
  const box = await page.locator('.container').boundingBox();
  const image = await page.screenshot({ clip: { x: 0, y: 0, width: 340, height: Math.ceil(box.y + box.height + 20) } });
  await context.close();
  return image.toString('base64');
}

async function main() {
  const popupImage = await capturePopup();
  const { context, extensionId } = await launchWithExtension({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  // タイマーの状態は拡張機能のページから直接書き込む
  const controller = await context.newPage();
  await controller.goto(`chrome-extension://${extensionId}/popup.html`);
  const page = await context.newPage();

  for (const [index, shot] of shots.entries()) {
    await context.route('https://fuse.example/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: renderSlide(shot, index, popupImage) }),
    );
    await page.goto(`https://fuse.example/${index + 1}`);
    await controller.evaluate(async ({ theme, progress, complete, total }) => {
      const elapsed = complete ? total + 1 : Math.round(total * progress);
      await chrome.storage.sync.set({ selectedTheme: theme });
      await chrome.storage.local.set({
        timerState: { isRunning: true, totalSeconds: total, startTime: Date.now() - elapsed * 1000 },
      });
    }, { theme: shot.theme, progress: shot.progress, complete: shot.complete, total: shot.total || TOTAL_SECONDS });
    await page.bringToFront();
    // アイコンのSVGの読み込みとアニメーションが落ち着くのを待つ
    await page.waitForTimeout(1500);
    const out = path.join(storeDir, shot.file);
    await page.screenshot({ path: out });
    await context.unroute('https://fuse.example/**');
    console.log(`${path.relative(process.cwd(), out)} を作成しました`);
  }
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
