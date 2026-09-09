/**
 * 从 data/projects.json + data/package.json 生成 public/bootstrap-data.js
 *
 * 背景：审核工具要打包给审核人员离线使用（file:// 打开，起不了服务）。
 * file:// 下浏览器无法 fetch('data/projects.json')，所以前端数据必须写成
 * `window.__PROJECT_BOOTSTRAP__ = {...}` 这种 <script> 直接加载的形式。
 *
 * 以后只维护 data/projects.json 一份数据，打包前运行本脚本即可同步。
 *
 * 用法：
 *   node tools/build-bootstrap.js
 */
import fs from "node:fs/promises";
import path from "node:path";

const PROJECTS_PATH = path.resolve("data", "projects.json");
const PACKAGE_PATH = path.resolve("data", "package.json");
const OUTPUT_PATH = path.resolve("public", "bootstrap-data.js");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const projects = await readJson(PROJECTS_PATH);
  if (!Array.isArray(projects)) {
    throw new Error("data/projects.json 需要是项目数组。");
  }

  let packageInfo = { packageName: "" };
  try {
    packageInfo = await readJson(PACKAGE_PATH);
  } catch {
    console.warn("未找到 data/package.json，packageName 将留空。");
  }

  const bootstrap = {
    packageInfo,
    projects
  };

  const banner =
    "// 本文件由 tools/build-bootstrap.js 自动生成，请勿手动编辑。\n" +
    "// 数据源：data/projects.json + data/package.json\n" +
    `// 生成时间：${new Date().toISOString()}\n`;

  const content = `${banner}window.__PROJECT_BOOTSTRAP__ = ${JSON.stringify(bootstrap, null, 2)};\n`;

  await fs.writeFile(OUTPUT_PATH, content, "utf8");

  console.log(`已生成 ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`项目数：${projects.length}`);
  console.log(`套餐名：${packageInfo.packageName || "(空)"}`);
}

main().catch((error) => {
  console.error(`生成失败：${error.message}`);
  process.exitCode = 1;
});
