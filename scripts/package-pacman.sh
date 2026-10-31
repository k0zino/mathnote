#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
STAGE="$ROOT/packaging/stage"

echo "[1/4] building renderer"
npm run build

echo "[2/4] staging files"
rm -rf "$STAGE"
install -dm755 "$STAGE/usr/lib/mathnote"
cp -a dist electron package.json "$STAGE/usr/lib/mathnote/"

install -Dm755 packaging/mathnote.sh "$STAGE/usr/bin/mathnote"
install -Dm644 packaging/mathnote.desktop \
  "$STAGE/usr/share/applications/mathnote.desktop"

ICON_DIR="$STAGE/usr/share/icons/hicolor/512x512/apps"
install -dm755 "$ICON_DIR"
if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 512 -h 512 packaging/icon.svg -o "$ICON_DIR/mathnote.png"
elif command -v magick >/dev/null 2>&1; then
  magick -background none packaging/icon.svg -resize 512x512 "$ICON_DIR/mathnote.png"
else
  echo "需要 rsvg-convert 或 ImageMagick 来生成图标" >&2
  exit 1
fi

echo "[3/4] updating PKGBUILD version -> $VERSION"
sed -i "s/^pkgver=.*/pkgver=$VERSION/" packaging/PKGBUILD

echo "[4/4] makepkg"
cd packaging
rm -rf pkg src
makepkg -f --noconfirm

echo
ls -lh mathnote-*.pkg.tar.zst
