import fs from "node:fs/promises";
import path from "node:path";
import { createWorker, PSM } from "tesseract.js";

const DEFAULT_INPUT = path.join("tools", "ocr-input.sample.json");
const DEFAULT_OUTPUT = path.join("tools", "ocr-output.json");
const OCR_CACHE_DIR = path.resolve("tools", ".ocr-cache");

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function toImageList(project) {
  const images = Array.isArray(project.images) ? project.images : project.sourceImages;
  return (images || [])
    .map((image, index) => {
      if (typeof image === "string") {
        return { side: index === 0 ? "正面" : "反面", url: image };
      }
      return {
        side: image.side || (index === 0 ? "正面" : "反面"),
        url: image.url || image.originalUrl || image.path || "",
        name: image.name || `${project.resource_code || project.id || "image"}-${index + 1}.jpg`,
        type: image.type || "image/jpeg"
      };
    })
    .filter((image) => image.url);
}

function normalizeLines(text) {
  return String(text || "")
    .replace(/[|｜]/g, " ")
    .replace(/[，,]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function matchFirstNumber(pattern, text) {
  const match = String(text || "").match(pattern);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function parseRangeCandidates(text) {
  const ranges = [];
  const clean = String(text || "").replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  const regex = /(^|[^\d:])(\d{1,2})\s*(?:至|到|[-~—一])\s*(\d{1,2})(?!\s*[:：])/gu;
  for (const match of clean.matchAll(regex)) {
    const min = Number.parseInt(match[2], 10);
    const max = Number.parseInt(match[3], 10);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    if (min < 1 || max < 1 || min > max || max > 80) continue;
    ranges.push({ min, max });
  }
  return ranges;
}

function extractRoomSummary(text) {
  const total = matchFirstNumber(/总\s*包\s*间\s*数\s*量[^\d]{0,20}(\d{1,3})/u, text);
  const ranges = parseRangeCandidates(text);
  const peopleRanges = ranges.filter(({ min, max }) => !(min >= 17 && max <= 23));
  const roomCount = total ?? (peopleRanges.length ? peopleRanges.length : null);
  const minPeople = peopleRanges.length ? Math.min(...peopleRanges.map((item) => item.min)) : null;
  const maxPeople = peopleRanges.length ? Math.max(...peopleRanges.map((item) => item.max)) : null;
  return { roomCount, minPeople, maxPeople, ranges: peopleRanges };
}

function extractBooking(text) {
  const compact = String(text || "").replace(/\s+/g, "");
  const lunchMatch = compact.match(/午餐(?:时间)?([0-2]?\d[:：][0-5]\d)[-~—一到至]([0-2]?\d[:：][0-5]\d)/u);
  const dinnerMatch = compact.match(/晚餐(?:时间)?([0-2]?\d[:：][0-5]\d)[-~—一到至]([0-2]?\d[:：][0-5]\d)/u);
  return {
    serviceFee: "",
    minimumSpendOrDeposit: "",
    dedicatedRoomAttendant: "",
    selfServeDrinks: "",
    teaArtService: "",
    mealSplittingService: "",
    advanceDishDelivery: "",
    bookableDays: compact.includes("全部") ? ["全部"] : [],
    lunchTime: lunchMatch ? `${lunchMatch[1].replace("：", ":")}-${lunchMatch[2].replace("：", ":")}` : "",
    dinnerTime: dinnerMatch ? `${dinnerMatch[1].replace("：", ":")}-${dinnerMatch[2].replace("：", ":")}` : ""
  };
}

function buildProject(project, imageResults) {
  const rawText = imageResults.map((item) => item.text).join("\n");
  const privateRoomSummary = extractRoomSummary(rawText);
  const warnings = [];
  if (!privateRoomSummary.roomCount) warnings.push("OCR 未稳定识别出包间数量");
  if (!privateRoomSummary.minPeople || !privateRoomSummary.maxPeople) warnings.push("OCR 未稳定识别出适用人数范围");
  warnings.push("普通 OCR 无法可靠判断打勾位置，餐厅基础信息和包间勾选项暂不自动填写");

  return {
    id: project.id || project.resource_code,
    restaurantName: project.restaurantName || "",
    resource_code: project.resource_code || project.id || "",
    custom_id: project.custom_id || "",
    status: project.status || "待审核",
    areaInfoStatus: project.areaInfoStatus || "待填写",
    projectEditUrl: project.projectEditUrl || "",
    starred: Boolean(project.starred),
    remarks: Array.isArray(project.remarks) ? project.remarks : [],
    totalPrivateRoomCount: privateRoomSummary.roomCount ? String(privateRoomSummary.roomCount) : "",
    privateRoomSummary: {
      roomCount: privateRoomSummary.roomCount,
      minPeople: privateRoomSummary.minPeople,
      maxPeople: privateRoomSummary.maxPeople
    },
    projectNotes: "",
    warnings,
    overallConfidence: null,
    basics: [],
    roomBooking: extractBooking(rawText),
    sourceImages: toImageList(project),
    ocrRawText: imageResults
  };
}

async function recognizeProjects(inputPath, outputPath) {
  const input = await readJson(inputPath);
  const projects = Array.isArray(input) ? input : input.projects;
  if (!Array.isArray(projects)) {
    throw new Error("输入 JSON 需要是项目数组，或包含 projects 数组。");
  }

  await fs.mkdir(OCR_CACHE_DIR, { recursive: true });

  const worker = await createWorker(["chi_sim", "eng"], 1, {
    cachePath: OCR_CACHE_DIR,
    cacheMethod: "write",
    logger: (message) => {
      if (message.status === "recognizing text") {
        const pct = Math.round((message.progress || 0) * 100);
        process.stdout.write(`\rOCR 识别中 ${pct}%   `);
      }
    }
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT
  });

  const output = [];
  try {
    for (const [projectIndex, project] of projects.entries()) {
      const images = toImageList(project);
      console.log(`\n[${projectIndex + 1}/${projects.length}] ${project.restaurantName || project.resource_code}`);
      const imageResults = [];
      for (const [imageIndex, image] of images.entries()) {
        console.log(`  - ${image.side || `图片${imageIndex + 1}`}：${image.url}`);
        try {
          const result = await worker.recognize(image.url);
          imageResults.push({
            side: image.side,
            url: image.url,
            confidence: result.data.confidence ?? null,
            text: result.data.text || "",
            lines: normalizeLines(result.data.text)
          });
        } catch (error) {
          imageResults.push({
            side: image.side,
            url: image.url,
            confidence: null,
            text: "",
            lines: [],
            error: error.message
          });
        }
      }
      output.push(buildProject(project, imageResults));
    }
  } finally {
    await worker.terminate();
  }

  await writeJson(outputPath, output);
  return output;
}

async function mergeIntoData(recognizedPath, dataPath) {
  const recognized = await readJson(recognizedPath);
  const current = await readJson(dataPath);
  const byCode = new Map(current.map((project) => [project.resource_code || project.id, project]));
  for (const project of recognized) {
    const key = project.resource_code || project.id;
    const existing = byCode.get(key) || {};
    byCode.set(key, {
      ...existing,
      ...project,
      status: existing.status || project.status || "待审核",
      areaInfoStatus: existing.areaInfoStatus || project.areaInfoStatus || "待填写",
      starred: existing.starred ?? project.starred ?? false,
      remarks: existing.remarks || project.remarks || [],
      updatedAt: new Date().toISOString()
    });
  }
  await writeJson(dataPath, Array.from(byCode.values()));
}

async function main() {
  const inputPath = getArg("--input", DEFAULT_INPUT);
  const outputPath = getArg("--output", DEFAULT_OUTPUT);
  const mergeDataPath = getArg("--merge-data");

  const recognized = await recognizeProjects(inputPath, outputPath);
  console.log(`\n已输出 OCR 结果：${outputPath}`);
  console.log(`项目数：${recognized.length}`);

  if (mergeDataPath || hasArg("--merge")) {
    const dataPath = mergeDataPath || path.join("data", "projects.json");
    await mergeIntoData(outputPath, dataPath);
    console.log(`已合并到：${dataPath}`);
  }
}

main().catch((error) => {
  console.error(`\nOCR 失败：${error.message}`);
  process.exitCode = 1;
});
