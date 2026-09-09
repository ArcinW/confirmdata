# 本地 OCR 试跑说明

这个脚本用于验证“不接 OpenAI API”的本地 OCR 方案。

## 是否需要申请账号或额外收费

不需要申请账号，也没有按量识别费用。

当前脚本使用开源的 `tesseract.js`，第一次运行时会联网下载中文/英文 OCR 模型文件，后续会复用本地缓存。

注意：这类普通 OCR 主要负责“从图片里读文字”，对手写包间名、手写人数、打勾位置的判断不稳定，准确率明显低于直接用视觉大模型识别。

## 怎么试跑

1. 修改 `tools/ocr-input.sample.json`，把要试跑的项目和图片链接放进去。
2. 双击 `试跑OCR.bat`。
3. 查看输出文件 `tools/ocr-output.json`。

## 输入格式

```json
[
  {
    "resource_code": "项目resource_code",
    "custom_id": "项目custom_id",
    "restaurantName": "餐厅名称",
    "images": [
      {
        "side": "正面",
        "url": "图片CDN链接"
      },
      {
        "side": "反面",
        "url": "图片CDN链接"
      }
    ]
  }
]
```

## 输出内容

脚本会输出：

- 项目基础字段
- 图片链接
- OCR 原始文字
- 尝试提取的包间数量、最小人数、最大人数
- warnings：哪些字段不可靠或没有识别出来

默认只输出到 `tools/ocr-output.json`，不会覆盖正式网页数据。

如果确认要把 OCR 结果合并进正式数据，可以运行：

```text
node tools\ocr-recognize.js --input tools\ocr-input.sample.json --output tools\ocr-output.json --merge-data data\projects.json
```

合并前建议先人工看一遍 `tools/ocr-output.json`，避免把错误识别写进正式数据。
