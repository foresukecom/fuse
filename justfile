# ローカル開発用のタスク。`just` でレシピ一覧を表示する
# ツールは devShell（nix develop / direnv）に入っている前提

# 拡張機能として配布するファイル・ディレクトリ
extension_files := "manifest.json content.js popup.html popup.js icons"

# レシピ一覧
default:
    @just --list --unsorted

# 配布ファイルだけを dist/extension/ にコピーする。Chrome にはこのディレクトリを読み込む
build:
    rm -rf dist/extension
    mkdir -p dist/extension
    cp -R {{ extension_files }} dist/extension/
    find dist/extension -name .DS_Store -delete
    @echo "dist/extension/ を作成しました"

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

# 生成物を削除する
clean:
    rm -rf dist
