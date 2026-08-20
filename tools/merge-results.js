import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const inputDir = path.resolve(process.argv[2] || path.join(rootDir, "审核结果"));
const outputDir = path.resolve(process.argv[3] || path.join(rootDir, "汇总结果"));

function fieldValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function csvCell(value) {
  return `"${fieldValue(value).replaceAll('"', '""')}"`;
}

function projectKey(project) {
  return project.id || project.restaurantName || JSON.stringify(project).slice(0, 80);
}

function updatedTime(project) {
  const time = Date.parse(project.updatedAt || project.createdAt || "");
  return Number.isNaN(time) ? 0 : time;
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.projects)) return payload.projects;
  return [];
}

function remarksText(project) {
  return (project.remarks || []).map((remark, index) => {
    if (typeof remark === "string") return `备注${index + 1}:${remark}`;
    return `备注${index + 1}:${remark.field || ""}-${remark.text || ""}`;
  }).join("；");
}

function roomSummary(project) {
  const summary = project.privateRoomSummary || {};
  const rooms = Array.isArray(project.privateRooms) ? project.privateRooms : [];
  const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const mins = rooms.map((room) => toNumber(room.minPeople)).filter((value) => value !== null);
  const maxs = rooms.map((room) => toNumber(room.maxPeople)).filter((value) => value !== null);
  return {
    roomCount: toNumber(summary.roomCount) ?? toNumber(project.totalPrivateRoomCount) ?? (rooms.length || ""),
    minPeople: toNumber(summary.minPeople) ?? (mins.length ? Math.min(...mins) : ""),
    maxPeople: toNumber(summary.maxPeople) ?? (maxs.length ? Math.max(...maxs) : "")
  };
}

function basicsText(project) {
  return (project.basics || []).map((item) => {
    return `${item.field || ""}:${fieldValue(item.selectedValues)}`;
  }).join("；");
}

function bookingText(project) {
  return Object.entries(project.roomBooking || {}).map(([key, value]) => {
    return `${key}:${fieldValue(value)}`;
  }).join("；");
}

async function readJsonFiles() {
  await fs.mkdir(inputDir, { recursive: true });
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(inputDir, entry.name));

  const projects = [];
  const errors = [];

  for (const file of files) {
    try {
      const payload = JSON.parse(await fs.readFile(file, "utf8"));
      for (const project of normalizePayload(payload)) {
        projects.push({
          ...project,
          _sourceFile: path.basename(file)
        });
      }
    } catch (error) {
      errors.push({ file: path.basename(file), error: error.message });
    }
  }

  return { files, projects, errors };
}

function mergeProjects(projects) {
  const merged = new Map();
  const conflicts = [];

  for (const project of projects) {
    const key = projectKey(project);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, project);
      continue;
    }

    conflicts.push({
      key,
      keptSource: updatedTime(project) >= updatedTime(existing) ? project._sourceFile : existing._sourceFile,
      replacedSource: updatedTime(project) >= updatedTime(existing) ? existing._sourceFile : project._sourceFile,
      restaurantName: project.restaurantName || existing.restaurantName || ""
    });

    if (updatedTime(project) >= updatedTime(existing)) merged.set(key, project);
  }

  return {
    projects: [...merged.values()].sort((a, b) => fieldValue(a.restaurantName).localeCompare(fieldValue(b.restaurantName), "zh-Hans-CN")),
    conflicts
  };
}

async function writeOutputs(projects, conflicts, errors) {
  await fs.mkdir(outputDir, { recursive: true });

  const cleanProjects = projects.map(({ _sourceFile, ...project }) => ({
    ...project,
    sourceResultFile: _sourceFile
  }));

  await fs.writeFile(
    path.join(outputDir, "汇总结果.json"),
    `${JSON.stringify(cleanProjects, null, 2)}\n`,
    "utf8"
  );

  const headers = ["来源文件", "项目ID", "项目名称", "resource_code", "custom_code", "审核状态", "区域信息", "星标", "备注", "包间数量", "适用人数最少", "适用人数最多", "餐厅基础信息", "包间预订", "更新时间"];
  const rows = cleanProjects.map((project) => {
    const summary = roomSummary(project);
    return [
      project.sourceResultFile,
      project.id,
      project.restaurantName,
      project.resource_code,
      project.custom_code,
      project.status,
      project.areaInfoStatus,
      project.starred ? "是" : "否",
      remarksText(project),
      summary.roomCount,
      summary.minPeople,
      summary.maxPeople,
      basicsText(project),
      bookingText(project),
      project.updatedAt
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  await fs.writeFile(path.join(outputDir, "汇总结果.csv"), `\ufeff${csv}`, "utf8");

  await fs.writeFile(
    path.join(outputDir, "重复项目记录.json"),
    `${JSON.stringify(conflicts, null, 2)}\n`,
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDir, "读取失败记录.json"),
    `${JSON.stringify(errors, null, 2)}\n`,
    "utf8"
  );
}

const { files, projects, errors } = await readJsonFiles();
if (!files.length) {
  console.log(`没有找到审核结果 JSON。请把各工具包导出的 JSON 放到：${inputDir}`);
  process.exit(0);
}

const { projects: mergedProjects, conflicts } = mergeProjects(projects);
await writeOutputs(mergedProjects, conflicts, errors);

console.log(`已读取 ${files.length} 个 JSON 文件。`);
console.log(`原始项目 ${projects.length} 条，汇总后 ${mergedProjects.length} 条。`);
console.log(`重复项目 ${conflicts.length} 条，读取失败 ${errors.length} 个文件。`);
console.log(`输出目录：${outputDir}`);
