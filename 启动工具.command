#!/bin/bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "未检测到 Node.js。请先安装 Node.js 18 或更高版本，然后重新双击启动工具.command。" buttons {"知道了"} default button "知道了"' >/dev/null 2>&1 || true
  open "https://nodejs.org/" >/dev/null 2>&1 || true
  exit 1
fi

START_PORT="${PORT:-5173}"
PORT=""
for candidate in "$START_PORT" 5174 5175 5176 5177 5178 5179 5180; do
  if ! lsof -iTCP:"$candidate" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    PORT="$candidate"
    break
  fi
done

if [ -z "$PORT" ]; then
  osascript -e 'display dialog "5173-5180 端口都被占用，请关闭其他本地工具后再启动。" buttons {"知道了"} default button "知道了"' >/dev/null 2>&1 || true
  exit 1
fi

mkdir -p logs
PORT="$PORT" nohup node server.js > "logs/server.log" 2>&1 &
sleep 1

open "http://127.0.0.1:$PORT/"
echo "采集确认单本地审核工具已启动："
echo "http://127.0.0.1:$PORT/"
echo
echo "这个窗口可以保留；审核结束后可直接关闭。"
