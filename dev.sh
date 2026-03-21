#!/usr/bin/env bash
# dev.sh — 设置 webkit2gtk 环境变量并启动 Tauri 开发服务器
# /tmp 重启后会清空，届时需要重新运行 scripts/setup-webkit.sh

set -e

# 确保 cargo 在 PATH 中
export PATH="$HOME/.cargo/bin:$PATH"

WEBKIT_EXTRACT=/tmp/webkit-extract
WEBKIT_LIBS=/tmp/webkit-libs

# 检查 webkit 依赖是否已提取，若缺失则自动执行 setup
if [ ! -f "$WEBKIT_EXTRACT/usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc" ]; then
  echo "webkit2gtk dev files not found in /tmp, running setup..."
  bash "$(dirname "$0")/scripts/setup-webkit.sh"
fi

export PKG_CONFIG_PATH="$WEBKIT_EXTRACT/usr/lib/x86_64-linux-gnu/pkgconfig:$WEBKIT_EXTRACT/usr/lib/pkgconfig"
export LIBRARY_PATH="$WEBKIT_LIBS"
export CPATH="$WEBKIT_EXTRACT/usr/include"
export RUSTFLAGS="-L $WEBKIT_LIBS"

exec npm run tauri dev
