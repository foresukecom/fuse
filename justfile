# ローカル開発用のタスク。`just` でレシピ一覧を表示する
# ツールは devShell（nix develop / direnv）に入っている前提

# 拡張機能として配布するファイル・ディレクトリ
extension_files := "manifest.json content.js popup.html popup.js icons"

# レシピ一覧
default:
    @just --list --unsorted

# 依存のインストール（初回・clone 直後）。postinstall で Playwright 用の Chromium も取得する
setup:
    npm install

# 配布ファイルだけを dist/extension/ にコピーする。Chrome にはこのディレクトリを読み込む
build:
    rm -rf dist/extension
    mkdir -p dist/extension
    cp -R {{ extension_files }} dist/extension/
    find dist/extension -name .DS_Store -delete
    @echo "dist/extension/ を作成しました"

# Playwright のテストを実行する（dist/extension/ を読み込むため、先にビルドする）
test: build
    npm test

# ストア提出用の ZIP を dist/ に作成する
package: build
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(node -p "require('./manifest.json').version")
    zip_path="$PWD/dist/fuse-${version}.zip"
    rm -f "$zip_path"
    # -X: macOSの拡張属性などを含めない
    (cd dist/extension && zip -r -X "$zip_path" .)
    echo "dist/fuse-${version}.zip を作成しました"

# images/icon-source*.svg から icons/ の拡張機能アイコンを再生成する
icons:
    ./scripts/generate-icons.sh

# 生成物を削除する
clean:
    rm -rf dist test-results playwright-report
