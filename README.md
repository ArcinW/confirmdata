# 采集确认单项目工具

一个本地网页工具，用来上传纸质采集确认单照片，识别成可校对的项目数据，并保存到本地 `data/projects.json`。

## 使用

1. 准备 OpenAI API Key。
2. 在当前目录运行：

   ```powershell
   npm start
   ```

3. 打开 `http://localhost:5173`。
4. 上传确认单照片，点击“开始识别”，检查字段后保存项目。

也可以在启动前设置环境变量，这样页面里的 Key 可以留空：

```powershell
$env:OPENAI_API_KEY="你的 API Key"
npm start
```

## 输出数据

- 项目记录保存在 `data/projects.json`。
- 页面右上角可导出 JSON 或 CSV。
- 页面中的 Key 只用于本次识别请求，不会写入项目数据文件。
