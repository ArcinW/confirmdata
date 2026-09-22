/**
 * 从 data/package.json 生成 public/bootstrap-data.js。
 *
 * 离线页面只内置工具包名称，不内置 data/projects.json 中的项目。
 * 审核人员首次打开时看到空列表，使用“导入 JSON”载入当前批次；
 * 导入后的完整批次由浏览器 localStorage 持久保存。
 *
 * 用法：
 *   node tools/build-bootstrap.js
 */
import fs from "node:fs/promises";
import path from "node:path";

const PACKAGE_PATH = path.resolve("data", "package.json");
const OUTPUT_PATH = path.resolve("public", "bootstrap-data.js");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  let packageInfo = { packageName: "" };
  try {
    packageInfo = await readJson(PACKAGE_PATH);
  } catch {
    console.warn("未找到 data/package.json，packageName 将留空。");
  }

  const bootstrap = {
    packageInfo,
    projects: []
  };

  const banner =
    "// 本文件由 tools/build-bootstrap.js 自动生成，请勿手动编辑。\n" +
    "// 页面不内置项目数据；项目由审核人员导入并保存到浏览器本地缓存。\n" +
    `// 生成时间：${new Date().toISOString()}\n`;

  const content = `${banner}window.__PROJECT_BOOTSTRAP__ = ${JSON.stringify(bootstrap, null, 2)};\n`;

  await fs.writeFile(OUTPUT_PATH, content, "utf8");

  console.log(`已生成 ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log("内置项目数：0（请在页面中导入批次 JSON）");
  console.log(`套餐名：${packageInfo.packageName || "(空)"}`);
}

main().catch((error) => {
  console.error(`生成失败：${error.message}`);
  process.exitCode = 1;
});
