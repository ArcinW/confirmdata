const state = {
  projects: [],
  currentProject: emptyProject(),
  activeImageIndex: 0
};

const fixedBasicFields = [
  "餐厅停车场",
  "餐厅景观类型",
  "餐厅等位区",
  "可携带宠物区",
  "洗手间",
  "物品寄存区",
  "吸烟区",
  "露台/户外座位",
  "收银台",
  "楼梯间/电梯设备",
  "酒水吧台",
  "儿童游乐区",
  "明厨亮灶",
  "生鲜海鲜区",
  "母婴室",
  "周边卖货区",
  "无障碍设施",
  "有舞台设施"
];

const basicOptionConfigs = {
  "餐厅停车场": ["门口独立停车场", "地下停车场", "路边停车场", "无停车场"],
  "餐厅景观类型": ["自然水景", "山林景观", "庭院景观", "城市景观", "高空景观", "其他"],
  "餐厅等位区": ["室内", "室外", "无"],
  "可携带宠物区": ["室内", "室外", "无"],
  "洗手间": ["餐厅内", "餐厅外"],
  "物品寄存区": ["餐厅内", "餐厅外", "无"],
  "吸烟区": ["有", "无"],
  "露台/户外座位": ["有", "无"],
  "收银台": ["有", "无"],
  "楼梯间/电梯设备": ["有", "无"],
  "酒水吧台": ["有", "无"],
  "儿童游乐区": ["有", "无"],
  "明厨亮灶": ["有", "无"],
  "生鲜海鲜区": ["有", "无"],
  "母婴室": ["有", "无"],
  "周边卖货区": ["有", "无"],
  "无障碍设施": ["有", "无"],
  "有舞台设施": ["有", "无"]
};

const bookingOptionConfigs = {
  serviceFee: { options: ["有", "无"], extraPlaceholder: "比例", extraSuffix: "%" },
  minimumSpendOrDeposit: { options: ["是", "否"], extraPlaceholder: "金额", extraSuffix: "元" },
  dedicatedRoomAttendant: { options: ["有", "无"] },
  selfServeDrinks: { options: ["是", "否", "白酒", "啤酒", "红酒"], extraPlaceholder: "其他酒水" },
  teaArtService: { options: ["有", "无"] },
  mealSplittingService: { options: ["有", "无"] },
  advanceDishDelivery: { options: ["有", "无"] },
  bookableDaysText: { options: ["全部", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期天"] }
};

const els = {
  form: document.querySelector("#projectForm"),
  projectId: document.querySelector("#projectId"),
  extraBasicList: document.querySelector("#extraBasicList"),
  roomList: document.querySelector("#roomList"),
  leftRoomColumn: document.querySelector('[data-room-column="left"]'),
  rightRoomColumn: document.querySelector('[data-room-column="right"]'),
  recordsList: document.querySelector("#recordsList"),
  recordCount: document.querySelector("#recordCount"),
  searchInput: document.querySelector("#searchInput"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  copyJsonBtn: document.querySelector("#copyJsonBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  deleteProjectBtn: document.querySelector("#deleteProjectBtn"),
  imageCount: document.querySelector("#imageCount"),
  imageTabs: document.querySelector("#imageTabs"),
  imageViewer: document.querySelector("#imageViewer"),
  status: document.querySelector("#status")
};

function emptyProject() {
  return {
    id: "",
    restaurantName: "",
    totalPrivateRoomCount: "",
    projectNotes: "",
    warnings: [],
    overallConfidence: "",
    basics: [],
    roomBooking: {
      serviceFee: "",
      minimumSpendOrDeposit: "",
      dedicatedRoomAttendant: "",
      selfServeDrinks: "",
      teaArtService: "",
      mealSplittingService: "",
      advanceDishDelivery: "",
      bookableDays: [],
      lunchTime: "",
      dinnerTime: "",
      bookingTimeNote: ""
    },
    privateRooms: [],
    sourceImages: []
  };
}

function normalizeProject(project = {}) {
  const normalized = { ...emptyProject(), ...project };
  delete normalized.collectorName;
  delete normalized.collectionDate;
  delete normalized.completionTime;
  delete normalized.contactPhone;
  delete normalized.acceptanceSignature;
  delete normalized.preparationItems;
  normalized.warnings = Array.isArray(project.warnings) ? project.warnings : [];
  normalized.basics = Array.isArray(project.basics) ? project.basics : [];
  normalized.privateRooms = Array.isArray(project.privateRooms) ? project.privateRooms : [];
  normalized.roomBooking = { ...emptyProject().roomBooking, ...(project.roomBooking || {}) };
  normalized.sourceImages = Array.isArray(project.sourceImages) ? project.sourceImages : [];
  return normalized;
}

function fieldValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function splitValues(value) {
  return fieldValue(value).split(/[、,，;；\s]+/).map((item) => item.trim()).filter(Boolean);
}

function compactText(value) {
  return fieldValue(value).replace(/\s+/g, "");
}

function selectedSetFromValue(value, options) {
  const raw = fieldValue(value);
  const compact = compactText(raw);
  const exact = splitValues(raw);
  const selected = new Set();
  const hasOnlyYesNo = options.length === 2
    && ((options.includes("有") && options.includes("无")) || (options.includes("是") && options.includes("否")));

  for (const option of options) {
    if (exact.includes(option) || compact.includes(option)) selected.add(option);
    if (hasOnlyYesNo && option === "有" && compact === "是") selected.add(option);
    if (hasOnlyYesNo && option === "无" && compact === "否") selected.add(option);
    if (hasOnlyYesNo && option === "是" && compact === "有") selected.add(option);
    if (hasOnlyYesNo && option === "否" && compact === "无") selected.add(option);
  }
  return selected;
}

function buildCheckGroup({ field, bookingKey, options, extraPlaceholder = "", extraSuffix = "" }) {
  const group = document.createElement("div");
  group.className = "check-options";
  if (field) group.dataset.basicField = field;
  if (bookingKey) group.dataset.booking = bookingKey;
  if (extraSuffix) group.dataset.extraSuffix = extraSuffix;

  for (const option of options) {
    const item = document.createElement("span");
    item.className = "check-item";
    item.innerHTML = `<input type="checkbox" value="${option}"><span>${option}</span>`;
    const checkbox = item.querySelector('input[type="checkbox"]');
    item.addEventListener("click", (event) => {
      if (event.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
    group.append(item);
  }

  if (extraPlaceholder) {
    const extra = document.createElement("input");
    extra.className = "option-extra";
    extra.type = "text";
    extra.placeholder = extraPlaceholder;
    group.append(extra);
  }

  return group;
}

function initializeOptionGroups() {
  for (const input of [...els.form.querySelectorAll("input[data-basic-field]")]) {
    const field = input.dataset.basicField;
    const options = basicOptionConfigs[field];
    if (!options) continue;
    input.replaceWith(buildCheckGroup({ field, options }));
  }

  for (const input of [...els.form.querySelectorAll("input[data-booking]")]) {
    const bookingKey = input.dataset.booking;
    const config = bookingOptionConfigs[bookingKey];
    if (!config) continue;
    input.replaceWith(buildCheckGroup({ bookingKey, ...config }));
  }
}

function optionGroups(selector) {
  return [...els.form.querySelectorAll(selector)];
}

function setGroupValues(group, value) {
  const options = [...group.querySelectorAll('input[type="checkbox"]')].map((input) => input.value);
  const selected = selectedSetFromValue(value, options);
  for (const checkbox of group.querySelectorAll('input[type="checkbox"]')) {
    checkbox.checked = selected.has(checkbox.value);
  }

  const extra = group.querySelector(".option-extra");
  if (extra) {
    const raw = fieldValue(value);
    const leftovers = splitValues(raw).filter((item) => !options.some((option) => item.includes(option)));
    extra.value = leftovers.join("、").replace(group.dataset.extraSuffix || "", "");
  }
}

function groupValues(group) {
  const checked = [...group.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  const extra = group.querySelector(".option-extra")?.value.trim();
  if (extra) checked.push(group.dataset.extraSuffix ? `${extra}${group.dataset.extraSuffix}` : extra);
  return checked;
}

function setStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = `status ${type}`;
}

function requestJson(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "请求失败。");
    return body;
  });
}

function basicMap(project) {
  return new Map((project.basics || []).filter((item) => item.field).map((item) => [item.field, item]));
}

function clearForm() {
  for (const element of els.form.elements) {
    if (element.matches?.("button")) continue;
    if (element.type === "checkbox") {
      element.checked = false;
      continue;
    }
    if ("value" in element) element.value = "";
  }
  for (const group of optionGroups(".check-options")) {
    setGroupValues(group, []);
  }
  els.extraBasicList.innerHTML = "";
  els.leftRoomColumn.innerHTML = "";
  els.rightRoomColumn.innerHTML = "";
}

function setNamedValue(name, value) {
  const element = els.form.elements.namedItem(name);
  if (element) element.value = fieldValue(value);
}

function renderBasics(project) {
  const map = basicMap(project);
  for (const group of optionGroups(".check-options[data-basic-field]")) {
    const item = map.get(group.dataset.basicField);
    setGroupValues(group, item ? item.selectedValues : []);
  }

  for (const item of project.basics || []) {
    if (!fixedBasicFields.includes(item.field)) addBasicRow(item);
  }
}

function renderBooking(project) {
  const booking = project.roomBooking || {};
  for (const group of optionGroups(".check-options[data-booking]")) {
    const key = group.dataset.booking;
    setGroupValues(group, key === "bookableDaysText" ? booking.bookableDays : booking[key]);
  }
  for (const input of els.form.querySelectorAll("input[data-booking]")) {
    const key = input.dataset.booking;
    input.value = fieldValue(booking[key]);
  }
}

function addBasicRow(data = {}) {
  const row = document.querySelector("#basicTemplate").content.cloneNode(true).querySelector(".extra-basic-row");
  row.querySelector('[data-field="field"]').value = data.field || "";
  row.querySelector('[data-field="value"]').value = fieldValue(data.selectedValues);
  row.querySelector('[data-field="note"]').value = data.note || "";
  row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
  els.extraBasicList.append(row);
}

function roomColumn(data = {}) {
  return data.column === "right" ? "right" : "left";
}

function addRoomRow(data = {}, column = roomColumn(data)) {
  const row = document.querySelector("#roomTemplate").content.cloneNode(true).querySelector(".room-paper-row");
  row.querySelector('[data-field="column"]').value = column;
  row.querySelector('[data-field="roomName"]').value = data.roomName || "";
  row.querySelector('[data-field="minPeople"]').value = data.minPeople ?? "";
  row.querySelector('[data-field="maxPeople"]').value = data.maxPeople ?? "";
  const noteInput = row.querySelector('[data-field="note"]');
  if (noteInput) noteInput.value = data.note || "";
  row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
  const target = column === "right" ? els.rightRoomColumn : els.leftRoomColumn;
  target.append(row);
}

function renderRooms(project) {
  els.leftRoomColumn.innerHTML = "";
  els.rightRoomColumn.innerHTML = "";
  project.privateRooms.forEach((room) => addRoomRow(room));
}

function imageLabel(image, index) {
  if (image.side) return image.side;
  if (index === 0) return "正面";
  if (index === 1) return "反面";
  return `图片 ${index + 1}`;
}

function imageUrl(image) {
  if (!image) return "";
  if (image.dataUrl) return image.dataUrl;
  if (image.url) return image.url;
  if (image.path) return `/api/image?path=${encodeURIComponent(image.path)}`;
  return "";
}

function renderImages(project) {
  const images = project.sourceImages || [];
  els.imageCount.textContent = `${images.length} 张`;
  els.imageTabs.innerHTML = "";
  els.imageViewer.innerHTML = "";

  if (!images.length) {
    els.imageViewer.innerHTML = '<div class="image-empty">这条记录还没有归档原始图片。</div>';
    return;
  }

  if (state.activeImageIndex >= images.length) state.activeImageIndex = 0;
  images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = imageLabel(image, index);
    button.className = index === state.activeImageIndex ? "active" : "";
    button.addEventListener("click", () => {
      state.activeImageIndex = index;
      renderImages(state.currentProject);
    });
    els.imageTabs.append(button);
  });

  const image = images[state.activeImageIndex];
  const url = imageUrl(image);
  els.imageViewer.innerHTML = url
    ? `<img src="${url}" alt="${image.name || imageLabel(image, state.activeImageIndex)}"><div class="image-meta">${image.name || ""}</div>`
    : `<div class="image-empty"><strong>${image.name || imageLabel(image, state.activeImageIndex)}</strong><span>原图未归档到工具目录。</span></div>`;
}

function renderForm(project) {
  state.currentProject = normalizeProject(project);
  state.activeImageIndex = 0;
  clearForm();

  els.projectId.value = state.currentProject.id || "";
  setNamedValue("restaurantName", state.currentProject.restaurantName);
  setNamedValue("totalPrivateRoomCount", state.currentProject.totalPrivateRoomCount);
  setNamedValue("projectNotes", state.currentProject.projectNotes);
  setNamedValue("warningsText", state.currentProject.warnings.join("\n"));
  setNamedValue("overallConfidence", state.currentProject.overallConfidence);
  renderBasics(state.currentProject);
  renderBooking(state.currentProject);
  renderRooms(state.currentProject);
  renderImages(state.currentProject);
  document.title = `${state.currentProject.restaurantName || "未命名项目"} - 采集确认单项目档案`;
  setStatus("");
}

function collectFixedBasics() {
  return optionGroups(".check-options[data-basic-field]").map((group) => ({
    field: group.dataset.basicField,
    selectedValues: groupValues(group),
    note: null,
    confidence: 1
  })).filter((item) => item.selectedValues.length);
}

function collectExtraBasics() {
  return [...els.extraBasicList.querySelectorAll(".extra-basic-row")].map((row) => {
    const field = row.querySelector('[data-field="field"]').value.trim();
    const value = row.querySelector('[data-field="value"]').value.trim();
    const note = row.querySelector('[data-field="note"]').value.trim();
    return { field, selectedValues: splitValues(value), note: note || null, confidence: 1 };
  }).filter((item) => item.field || item.selectedValues.length || item.note);
}

function collectBasics() {
  const byField = new Map();
  for (const item of [...collectFixedBasics(), ...collectExtraBasics()]) {
    if (item.field) byField.set(item.field, item);
  }
  return [...byField.values()];
}

function collectBooking() {
  const booking = {};
  for (const group of optionGroups(".check-options[data-booking]")) {
    if (group.dataset.booking === "bookableDaysText") booking.bookableDays = groupValues(group);
    else booking[group.dataset.booking] = groupValues(group).join("、") || null;
  }
  for (const input of els.form.querySelectorAll("input[data-booking]")) {
    if (input.dataset.booking === "bookableDaysText") booking.bookableDays = splitValues(input.value);
    else booking[input.dataset.booking] = input.value.trim() || null;
  }
  return booking;
}

function collectRooms() {
  return [...els.roomList.querySelectorAll(".room-paper-row")].map((row) => {
    const min = row.querySelector('[data-field="minPeople"]').value;
    const max = row.querySelector('[data-field="maxPeople"]').value;
    const note = row.querySelector('[data-field="note"]')?.value.trim() || "";
    const column = row.querySelector('[data-field="column"]').value === "right" ? "right" : "left";
    return {
      roomName: row.querySelector('[data-field="roomName"]').value.trim() || null,
      minPeople: min === "" ? null : Number(min),
      maxPeople: max === "" ? null : Number(max),
      rawCapacity: min || max ? `${min || ""} 至 ${max || ""}` : null,
      note: note || null,
      column,
      confidence: 1
    };
  }).filter((room) => room.roomName || room.minPeople !== null || room.maxPeople !== null || room.note);
}

function collectForm() {
  const form = new FormData(els.form);
  const confidenceRaw = form.get("overallConfidence");
  return {
    ...emptyProject(),
    id: els.projectId.value || "",
    restaurantName: form.get("restaurantName")?.trim() || null,
    totalPrivateRoomCount: form.get("totalPrivateRoomCount")?.trim() || null,
    projectNotes: form.get("projectNotes")?.trim() || null,
    warnings: form.get("warningsText")?.split("\n").map((item) => item.trim()).filter(Boolean) || [],
    overallConfidence: confidenceRaw === null || confidenceRaw === "" ? null : Number(confidenceRaw),
    basics: collectBasics(),
    roomBooking: collectBooking(),
    privateRooms: collectRooms(),
    sourceImages: state.currentProject.sourceImages || [],
    createdAt: state.currentProject.createdAt
  };
}

function recordSummary(project) {
  const parts = [
    project.totalPrivateRoomCount && `总包间 ${project.totalPrivateRoomCount}`,
    project.privateRooms?.length ? `已录包间 ${project.privateRooms.length}` : "",
    project.sourceImages?.length ? `原图 ${project.sourceImages.length}` : "无原图",
    project.updatedAt && `更新 ${project.updatedAt.slice(0, 10)}`
  ].filter(Boolean);
  return parts.join(" · ") || "暂无摘要";
}

function renderRecords() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const projects = state.projects.filter((project) => !keyword || JSON.stringify(project).toLowerCase().includes(keyword));
  els.recordCount.textContent = `${state.projects.length} 条`;
  els.recordsList.innerHTML = "";

  if (!projects.length) {
    els.recordsList.innerHTML = '<div class="empty">暂无项目记录</div>';
    return;
  }

  projects.forEach((project) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = project.id && project.id === state.currentProject.id ? "record-card active" : "record-card";
    card.innerHTML = `<strong>${project.restaurantName || "未命名项目"}</strong><span>${recordSummary(project)}</span>`;
    card.addEventListener("click", () => {
      renderForm(project);
      renderRecords();
    });
    els.recordsList.append(card);
  });
}

async function loadProjects() {
  const { projects } = await requestJson("/api/projects");
  state.projects = projects.map(normalizeProject);
  renderForm(state.projects[0] || emptyProject());
  renderRecords();
}

async function saveProject(event) {
  event.preventDefault();
  try {
    const { project: saved, projects } = await requestJson("/api/projects", {
      method: "POST",
      body: JSON.stringify({ project: collectForm() })
    });
    state.projects = projects.map(normalizeProject);
    renderForm(saved);
    renderRecords();
    setStatus("修改已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deleteCurrentProject() {
  const id = els.projectId.value;
  if (!id || !confirm("确认删除这条项目记录？")) return;
  try {
    const { projects } = await requestJson(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.projects = projects.map(normalizeProject);
    renderForm(state.projects[0] || emptyProject());
    renderRecords();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  download("采集确认单项目数据.json", JSON.stringify(state.projects, null, 2), "application/json;charset=utf-8");
}

function csvCell(value) {
  return `"${fieldValue(value).replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ["餐厅名称", "总包间数量", "餐厅基础信息", "包间预订", "包间", "提醒"];
  const rows = state.projects.map((project) => [
    project.restaurantName,
    project.totalPrivateRoomCount,
    (project.basics || []).map((item) => `${item.field || ""}:${fieldValue(item.selectedValues)}`).join("；"),
    Object.entries(project.roomBooking || {}).map(([key, value]) => `${key}:${fieldValue(value)}`).join("；"),
    (project.privateRooms || []).map((room) => `${room.roomName || ""}:${room.rawCapacity || ""}`).join("；"),
    (project.warnings || []).join("；")
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  download("采集确认单项目数据.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
}

async function copyCurrentJson() {
  await navigator.clipboard.writeText(JSON.stringify(collectForm(), null, 2));
  setStatus("当前项目 JSON 已复制。", "ok");
}

initializeOptionGroups();
els.form.addEventListener("submit", saveProject);
els.searchInput.addEventListener("input", renderRecords);
els.newProjectBtn.addEventListener("click", () => {
  renderForm(emptyProject());
  renderRecords();
});
els.copyJsonBtn.addEventListener("click", copyCurrentJson);
els.exportJsonBtn.addEventListener("click", exportJson);
els.exportCsvBtn.addEventListener("click", exportCsv);
els.deleteProjectBtn.addEventListener("click", deleteCurrentProject);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  if (button.dataset.add === "basic") addBasicRow();
  if (button.dataset.add === "room") addRoomRow({}, "left");
});

loadProjects().catch((error) => setStatus(error.message, "error"));
