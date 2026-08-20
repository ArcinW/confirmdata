#!/bin/bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "未检测到 Node.js。请先安装 Node.js 18 或更高版本，然后重新双击汇总审核结果.command。" buttons {"知道了"} default button "知道了"' >/dev/null 2>&1 || true
  open "https://nodejs.org/" >/dev/null 2>&1 || true
  exit 1
fi

node tools/merge-results.js
open "汇总结果" >/dev/null 2>&1 || true
echo
echo "汇总完成，结果已输出到：汇总结果"
echo "按回车关闭窗口。"
read -r
