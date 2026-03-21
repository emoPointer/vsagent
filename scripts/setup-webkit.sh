#!/usr/bin/env bash
# scripts/setup-webkit.sh — 从 apt 下载 webkit2gtk dev 包并提取到 /tmp
# 无需 sudo，适用于没有安装 libwebkit2gtk-4.1-dev 的环境
# 重启后 /tmp 清空，需要重新运行此脚本

set -e

WEBKIT_DL=/tmp/webkit-dl
WEBKIT_EXTRACT=/tmp/webkit-extract
WEBKIT_LIBS=/tmp/webkit-libs

echo "==> Creating directories..."
mkdir -p "$WEBKIT_DL" "$WEBKIT_EXTRACT" "$WEBKIT_LIBS"

echo "==> Downloading webkit2gtk dev packages (no sudo required)..."
cd "$WEBKIT_DL"
apt-get download \
  libwebkit2gtk-4.1-dev \
  libwebkit2gtk-4.1-0 \
  libjavascriptcoregtk-4.1-dev \
  libjavascriptcoregtk-4.1-0 \
  libsoup-3.0-dev \
  libsoup-3.0-0 \
  2>&1

echo "==> Extracting .deb packages..."
for f in "$WEBKIT_DL"/*.deb; do
  dpkg-deb -x "$f" "$WEBKIT_EXTRACT"
done

echo "==> Creating .so symlinks in $WEBKIT_LIBS..."
find "$WEBKIT_EXTRACT" -name "*.so*" | while read -r lib; do
  ln -sf "$lib" "$WEBKIT_LIBS/$(basename "$lib")" 2>/dev/null || true
done

echo "==> Patching .pc files to use extracted prefix..."
for f in "$WEBKIT_EXTRACT"/usr/lib/x86_64-linux-gnu/pkgconfig/*.pc \
         "$WEBKIT_EXTRACT"/usr/lib/pkgconfig/*.pc; do
  [ -f "$f" ] || continue
  sed -i "s|prefix=/usr|prefix=$WEBKIT_EXTRACT/usr|g" "$f"
done

echo ""
echo "Done. Run ./dev.sh to start the dev server."
