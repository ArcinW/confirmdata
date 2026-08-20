import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const projectsPath = path.join(dataDir, "projects.json");
const port = Number(process.env.PORT || 5173);
const imageRoots = [
  path.join(publicDir, "originals"),
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop", "美团") : "",
  ...(process.env.IMAGE_ROOTS ? process.env.IMAGE_ROOTS.split(path.delimiter) : [])
].filter(Boolean).map((root) => path.resolve(root));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(projectsPath);
  } catch {
    await fs.writeFile(projectsPath, "[]\n", "utf8");
  }
}

async function readProjects() {
  await ensureStore();
  const raw = await fs.readFile(projectsPath, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeProjects(projects) {
  await ensureStore();
  await fs.writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req, limit = 25 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error("请求内容过大，请压缩图片后重试。"), { status: 413 });
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function normalizeDataUrl(image) {
  if (!image?.dataUrl || typeof image.dataUrl !== "string") return null;
  if (!image.dataUrl.startsWith("data:image/")) return null;
  return image.dataUrl;
}

function resolveImagePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const target = path.resolve(rawPath);
  const isAllowed = imageRoots.some((root) => target === root || target.startsWith(`${root}${path.sep}`));
  return isAllowed ? target : null;
}

function sanitizeProject(project = {}) {
  const sanitized = { ...project };
  delete sanitized.collectorName;
  delete sanitized.collectionDate;
  delete sanitized.completionTime;
  delete sanitized.contactPhone;
  delete sanitized.acceptanceSignature;
  delete sanitized.preparationItems;
  return sanitized;
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    restaurantName: { type: ["string", "null"] },
    totalPrivateRoomCount: { type: ["string", "null"] },
    projectNotes: { type: ["string", "null"] },
    basics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          selectedValues: { type: "array", items: { type: "string" } },
          note: { type: ["string", "null"] },
          confidence: { type: "number" }
        },
        required: ["field", "selectedValues", "note", "confidence"]
      }
    },
    roomBooking: {
      type: "object",
      additionalProperties: false,
      properties: {
        serviceFee: { type: ["string", "null"] },
        minimumSpendOrDeposit: { type: ["string", "null"] },
        dedicatedRoomAttendant: { type: ["string", "null"] },
        selfServeDrinks: { type: ["string", "null"] },
        teaArtService: { type: ["string", "null"] },
        mealSplittingService: { type: ["string", "null"] },
        advanceDishDelivery: { type: ["string", "null"] },
        bookableDays: { type: "array", items: { type: "string" } },
        lunchTime: { type: ["string", "null"] },
        dinnerTime: { type: ["string", "null"] },
        bookingTimeNote: { type: ["string", "null"] }
      },
      required: [
        "serviceFee",
        "minimumSpendOrDeposit",
        "dedicatedRoomAttendant",
        "selfServeDrinks",
        "teaArtService",
        "mealSplittingService",
        "advanceDishDelivery",
        "bookableDays",
        "lunchTime",
        "dinnerTime",
        "bookingTimeNote"
      ]
    },
    privateRooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          roomName: { type: ["string", "null"] },
          minPeople: { type: ["number", "null"] },
          maxPeople: { type: ["number", "null"] },
          rawCapacity: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          confidence: { type: "number" }
        },
        required: ["roomName", "minPeople", "maxPeople", "rawCapacity", "note", "confidence"]
      }
    },
    warnings: { type: "array", items: { type: "string" } },
    overallConfidence: { type: "number" }
  },
  required: [
    "restaurantName",
    "totalPrivateRoomCount",
    "projectNotes",
    "basics",
    "roomBooking",
    "privateRooms",
    "warnings",
    "overallConfidence"
  ]
};

function buildPrompt(extraNote = "") {
  return [
    "你是中文纸质餐厅采集确认单的信息录入员。请从上传的照片中识别项目数据。",
    "照片可能包含两页：第 1 页通常是“采集服务确认单”，第 2 页通常是“包间信息”。表单中有印刷文字、手写文字和勾选框。",
    "不要识别、不要输出这些字段：采集日期、采集人员、采集完成时间、联系方式、对接人签名、现场确认项目。",
    "只记录确认单上真实出现的信息；看不清时填 null 或空数组，并在 warnings 写明。",
    "勾选框判断以手写对勾为准，不要把灰色印刷方块误判为已选。",
    "人数范围需要拆成 minPeople 和 maxPeople；例如“4 至 6”输出 4 和 6。",
    "日期尽量标准化为 YYYY-MM-DD；若年份或月份不确定，保留原文并在 warnings 说明。",
    "项目数据要便于后续做自动海报或项目交付追踪，所以不要输出解释文字，只输出 JSON。",
    extraNote ? `额外说明：${extraNote}` : ""
  ].filter(Boolean).join("\n");
}

function getOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

async function extractProject(payload) {
  const apiKey = payload.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("缺少 OpenAI API Key。可在页面输入，或启动前设置 OPENAI_API_KEY。"), { status: 400 });
  }

  const images = (payload.images || []).map(normalizeDataUrl).filter(Boolean);
  if (!images.length) {
    throw Object.assign(new Error("请至少上传一张确认单照片。"), { status: 400 });
  }

  const model = payload.model || process.env.OPENAI_MODEL || "gpt-5";
  const content = [
    { type: "input_text", text: buildPrompt(payload.note || "") },
    ...images.map((image_url) => ({ type: "input_image", image_url }))
  ];

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "collection_confirmation_project",
          strict: true,
          schema: extractionSchema
        }
      }
    })
  });

  const result = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    const message = result.error?.message || `识别接口请求失败：${apiResponse.status}`;
    throw Object.assign(new Error(message), { status: apiResponse.status });
  }

  const text = getOutputText(result);
  try {
    return sanitizeProject(JSON.parse(text));
  } catch {
    throw Object.assign(new Error("识别完成，但返回内容不是可用 JSON。请换一组更清晰的照片后重试。"), { status: 502 });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "禁止访问该路径。" });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "页面不存在。" });
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/projects") {
    sendJson(res, 200, { projects: await readProjects() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/image") {
    const imagePath = resolveImagePath(url.searchParams.get("path"));
    if (!imagePath) {
      sendJson(res, 403, { error: "原图路径不在允许读取的目录中。" });
      return;
    }

    try {
      const data = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    } catch {
      sendJson(res, 404, { error: "原图文件不存在。" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const body = await readBody(req);
    const projects = await readProjects();
    const now = new Date().toISOString();
    const incoming = {
      ...sanitizeProject(body.project),
      id: body.project?.id || randomUUID(),
      updatedAt: now,
      createdAt: body.project?.createdAt || now
    };
    const index = projects.findIndex((project) => project.id === incoming.id);
    if (index >= 0) projects[index] = incoming;
    else projects.unshift(incoming);
    await writeProjects(projects);
    sendJson(res, 200, { project: incoming, projects });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1]);
    const projects = (await readProjects()).filter((project) => project.id !== id);
    await writeProjects(projects);
    sendJson(res, 200, { projects });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/extract") {
    const body = await readBody(req);
    const extracted = await extractProject(body);
    sendJson(res, 200, { extracted });
    return;
  }

  sendJson(res, 404, { error: "接口不存在。" });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) await handleApi(req, res);
    else await serveStatic(req, res);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "服务异常。" });
  }
});

await ensureStore();
server.listen(port, () => {
  console.log(`采集确认单项目工具已启动：http://localhost:${port}`);
});
