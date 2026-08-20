const PAGE_SIZE = 30;

const state = {
  projects: [],
  currentProject: emptyProject(),
  currentSnapshot: "",
  currentPage: 1,
  packageName: "审核结果",
  isSaving: false
};

const auditStatuses = ["待审核", "已审核"];
const areaInfoStatuses = ["待填写", "已填写"];

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
  topbar: document.querySelector(".topbar"),
  topbarIntro: document.querySelector("#topbarIntro"),
  homeView: document.querySelector("#homeView"),
  detailView: document.querySelector("#detailView"),
  form: document.querySelector("#projectForm"),
  projectId: document.querySelector("#projectId"),
  extraBasicList: document.querySelector("#extraBasicList"),
  projectTableBody: document.querySelector("#projectTableBody"),
  pagination: document.querySelector("#pagination"),
  recordCount: document.querySelector("#recordCount"),
  searchInput: document.querySelector("#searchInput"),
  backHomeBtn: document.querySelector("#backHomeBtn"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  deleteProjectBtn: document.querySelector("#deleteProjectBtn"),
  confirmProjectBtn: document.querySelector("#confirmProjectBtn"),
  frontImageViewer: document.querySelector("#frontImageViewer"),
  backImageViewer: document.querySelector("#backImageViewer"),
  areaView: null,
  areaProjectName: null,
  areaResourceCode: null,
  areaCustomCode: null,
  areaEditEntry: null,
  areaImageViewer: null,
  areaDoneBtn: null,
  areaStatus: null,
  status: document.querySelector("#status")
};

function emptyProject() {
  return {
    id: "",
    restaurantName: "",
    resource_code: "",
    custom_code: "",
    status: "待审核",
    areaInfoStatus: "待填写",
    projectEditUrl: "",
    starred: false,
    remarks: [],
    totalPrivateRoomCount: "",
    privateRoomSummary: {
      roomCount: null,
      minPeople: null,
      maxPeople: null
    },
    projectNotes: "",
    warnings: [],
    overallConfidence: null,
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

function normalizeRemarks(remarks) {
  if (!Array.isArray(remarks)) return [];
  return remarks.map((item) => {
    if (typeof item === "string") return { field: "", text: item };
    return {
      field: item?.field ? String(item.field) : "",
      text: item?.text ? String(item.text) : ""
    };
  }).filter((item) => item.field || item.text);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function deriveRoomSummary(project = {}) {
  const source = project.privateRoomSummary || {};
  const rooms = Array.isArray(project.privateRooms) ? project.privateRooms : [];
  const mins = rooms.map((room) => nullableNumber(room.minPeople)).filter((value) => value !== null);
  const maxs = rooms.map((room) => nullableNumber(room.maxPeople)).filter((value) => value !== null);
  const parsedRoomCount = nullableNumber(source.roomCount ?? project.totalPrivateRoomCount);
  return {
    roomCount: parsedRoomCount ?? (rooms.length ? rooms.length : null),
    minPeople: nullableNumber(source.minPeople) ?? (mins.length ? Math.min(...mins) : null),
    maxPeople: nullableNumber(source.maxPeople) ?? (maxs.length ? Math.max(...maxs) : null)
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
  if (normalized.status === "已填写") {
    normalized.areaInfoStatus = "已填写";
    normalized.status = "待审核";
  }
  if (normalized.status === "已确认" || normalized.status === "审核完毕") normalized.status = "已审核";
  normalized.status = auditStatuses.includes(normalized.status) ? normalized.status : "待审核";
  normalized.areaInfoStatus = areaInfoStatuses.includes(normalized.areaInfoStatus) ? normalized.areaInfoStatus : "待填写";
  normalized.resource_code = fieldValue(normalized.resource_code);
  normalized.custom_code = fieldValue(normalized.custom_code);
  normalized.projectEditUrl = fieldValue(normalized.projectEditUrl);
  normalized.starred = Boolean(normalized.starred);
  normalized.remarks = normalizeRemarks(normalized.remarks);
  normalized.warnings = Array.isArray(project.warnings) ? project.warnings : [];
  normalized.basics = Array.isArray(project.basics) ? project.basics : [];
  normalized.privateRooms = Array.isArray(project.privateRooms) ? project.privateRooms : [];
  normalized.privateRoomSummary = deriveRoomSummary(project);
  if (!normalized.totalPrivateRoomCount && normalized.privateRoomSummary.roomCount !== null) {
    normalized.totalPrivateRoomCount = String(normalized.privateRoomSummary.roomCount);
  }
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

function escapeHtml(value) {
  return fieldValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function enforceExclusiveOption(group, changedCheckbox) {
  if (!changedCheckbox?.checked) return;
  const exclusiveSets = [
    ["有", "无"],
    ["是", "否"],
    ["正常", "受阻"],
    ["已打开", "未打开"],
    ["与现场一致", "有改动"]
  ];
  const matchedSet = exclusiveSets.find((set) => set.includes(changedCheckbox.value));
  if (!matchedSet) return;

  for (const checkbox of group.querySelectorAll('input[type="checkbox"]')) {
    if (checkbox !== changedCheckbox && matchedSet.includes(checkbox.value)) {
      checkbox.checked = false;
    }
  }
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
    item.innerHTML = `<input type="checkbox" value="${escapeHtml(option)}"><span>${escapeHtml(option)}</span>`;
    const checkbox = item.querySelector('input[type="checkbox"]');
    item.addEventListener("click", (event) => {
      if (event.target === checkbox) return;
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      enforceExclusiveOption(group, checkbox);
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
    checkbox.addEventListener("change", () => enforceExclusiveOption(group, checkbox));
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

function ensureToast() {
  let toast = document.querySelector("#toast");
  if (toast) return toast;
  toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "toast";
  document.body.append(toast);
  return toast;
}

function showToast(message) {
  const toast = ensureToast();
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function showModal({ title, message, confirmText = "确认", cancelText = "取消", danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h3 id="modalTitle">${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="ghost" data-modal-cancel type="button">${escapeHtml(cancelText)}</button>
          <button class="${danger ? "danger-action" : "primary"}" data-modal-confirm type="button">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    const close = (result) => {
      overlay.remove();
      resolve(result);
    };
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => close(true));
    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => close(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    document.body.append(overlay);
    overlay.querySelector("[data-modal-confirm]").focus();
  });
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

function renderRoomSummary(project) {
  const summary = deriveRoomSummary(project);
  setNamedValue("totalPrivateRoomCount", summary.roomCount ?? project.totalPrivateRoomCount);
  setNamedValue("roomMinPeople", summary.minPeople);
  setNamedValue("roomMaxPeople", summary.maxPeople);
}

function imageLabel(image, index) {
  if (image?.side) return image.side;
  if (index === 0) return "正面";
  if (index === 1) return "反面";
  return `图片 ${index + 1}`;
}

function imageUrl(image) {
  if (!image) return "";
  if (image.dataUrl) return image.dataUrl;
  if (image.url) return image.url;
  if (image.path) {
    const normalized = image.path.replaceAll("\\", "/");
    const marker = "/public/originals/";
    const markerIndex = normalized.toLowerCase().indexOf(marker);
    if (markerIndex >= 0) {
      return `/originals/${encodeURIComponent(normalized.slice(markerIndex + marker.length))}`;
    }
    return `/api/image?path=${encodeURIComponent(image.path)}`;
  }
  return "";
}

function setupImagePanZoom(target) {
  const viewport = target.querySelector(".image-viewport");
  const img = target.querySelector("img");
  if (!viewport || !img) return;
  img.draggable = false;

  const transform = { scale: 1, x: 0, y: 0 };
  const apply = () => {
    img.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
  };
  const zoom = (delta) => {
    transform.scale = Math.min(4, Math.max(0.5, Number((transform.scale + delta).toFixed(2))));
    if (transform.scale === 1) {
      transform.x = 0;
      transform.y = 0;
    }
    apply();
  };
  const reset = () => {
    transform.scale = 1;
    transform.x = 0;
    transform.y = 0;
    apply();
  };

  target.querySelector('[data-image-action="zoom-in"]')?.addEventListener("click", () => zoom(0.25));
  target.querySelector('[data-image-action="zoom-out"]')?.addEventListener("click", () => zoom(-0.25));
  target.querySelector('[data-image-action="reset"]')?.addEventListener("click", reset);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.15 : -0.15);
  }, { passive: false });

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  viewport.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = transform.x;
    originY = transform.y;
    viewport.classList.add("dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    if ((event.buttons & 1) !== 1) {
      stopDragging(event);
      return;
    }
    event.preventDefault();
    transform.x = originX + event.clientX - startX;
    transform.y = originY + event.clientY - startY;
    apply();
  });

  const stopDragging = (event) => {
    dragging = false;
    viewport.classList.remove("dragging");
    if (event?.pointerId !== undefined && viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);
  img.addEventListener("dragstart", (event) => event.preventDefault());
  apply();
}

function renderImageSlot(target, image, index) {
  const url = imageUrl(image);
  target.innerHTML = url
    ? `
      <div class="image-toolbar">
        <button data-image-action="zoom-out" type="button">缩小</button>
        <button data-image-action="reset" type="button">重置</button>
        <button data-image-action="zoom-in" type="button">放大</button>
      </div>
      <div class="image-viewport">
        <img src="${url}" alt="${escapeHtml(image?.name || imageLabel(image, index))}" data-image-label="${escapeHtml(image?.name || imageLabel(image, index))}">
      </div>
      <div class="image-meta">${escapeHtml(image?.name || imageLabel(image, index))}</div>`
    : `<div class="image-empty"><strong>${imageLabel(image, index)}</strong><span>未找到对应原始图片。</span></div>`;

  const img = target.querySelector("img");
  if (img) {
    setupImagePanZoom(target);
    img.addEventListener("error", () => {
      target.innerHTML = `<div class="image-empty"><strong>${escapeHtml(img.dataset.imageLabel || imageLabel(image, index))}</strong><span>原图文件不存在或当前服务无法读取。</span></div>`;
    }, { once: true });
  }
}

function renderPaperImages(project) {
  const images = project.sourceImages || [];
  renderImageSlot(els.frontImageViewer, images[0], 0);
  renderImageSlot(els.backImageViewer, images[1], 1);
}

function roomInfoImage(project) {
  const images = project.sourceImages || [];
  return images.find((image) => image.side === "反面") || images[1] || images[0];
}

function ensureAreaView() {
  if (els.areaView) return;

  const areaView = document.createElement("section");
  areaView.id = "areaView";
  areaView.className = "area-view";
  areaView.hidden = true;
  areaView.innerHTML = `
    <div class="area-panel">
      <div class="area-head">
        <section class="project-code-bar area-code-bar">
          <label>
            <span>餐厅名称</span>
            <b id="areaProjectName"></b>
          </label>
          <label>
            <span>resource_code</span>
            <b id="areaResourceCode"></b>
          </label>
          <label>
            <span>custom_code</span>
            <b id="areaCustomCode"></b>
          </label>
        </section>
        <button id="areaEditEntry" class="blue-action area-edit-entry" type="button">如视编辑入口</button>
      </div>
      <div class="area-image-card">
        <div class="preview-head">
          <h2>包间信息原图</h2>
          <span>原始图片</span>
        </div>
        <div id="areaImageViewer" class="paper-image area-paper-image"></div>
      </div>
      <div class="area-actions">
        <button id="areaDoneBtn" class="primary" type="button">填写完毕</button>
      </div>
      <div id="areaStatus" class="status" role="status"></div>
    </div>
  `;
  document.querySelector("main").append(areaView);

  els.areaView = areaView;
  els.areaProjectName = areaView.querySelector("#areaProjectName");
  els.areaResourceCode = areaView.querySelector("#areaResourceCode");
  els.areaCustomCode = areaView.querySelector("#areaCustomCode");
  els.areaEditEntry = areaView.querySelector("#areaEditEntry");
  els.areaImageViewer = areaView.querySelector("#areaImageViewer");
  els.areaDoneBtn = areaView.querySelector("#areaDoneBtn");
  els.areaStatus = areaView.querySelector("#areaStatus");
  els.areaDoneBtn.addEventListener("click", markAreaFilled);
  els.areaEditEntry.addEventListener("click", () => {
    const url = state.currentProject.projectEditUrl;
    if (url) window.open(url, "_blank", "noopener");
    else showToast("如视编辑入口待配置");
  });
}

function renderAreaPage(project) {
  ensureAreaView();
  state.currentProject = normalizeProject(project);
  els.areaProjectName.textContent = state.currentProject.restaurantName || "未命名项目";
  els.areaResourceCode.textContent = state.currentProject.resource_code || "";
  els.areaCustomCode.textContent = state.currentProject.custom_code || "";
  renderImageSlot(els.areaImageViewer, roomInfoImage(state.currentProject), 1);
  els.areaStatus.textContent = "";
  els.areaStatus.className = "status";
  document.title = `${state.currentProject.restaurantName || "未命名项目"} - 区域信息对照`;
}

function renderForm(project) {
  state.currentProject = normalizeProject(project);
  clearForm();

  els.projectId.value = state.currentProject.id || "";
  setNamedValue("restaurantName", state.currentProject.restaurantName);
  setNamedValue("restaurantNamePaper", state.currentProject.restaurantName);
  setNamedValue("resource_code", state.currentProject.resource_code);
  setNamedValue("custom_code", state.currentProject.custom_code);
  setNamedValue("projectNotes", state.currentProject.projectNotes);
  renderBasics(state.currentProject);
  renderBooking(state.currentProject);
  renderRoomSummary(state.currentProject);
  renderPaperImages(state.currentProject);
  document.title = `${state.currentProject.restaurantName || "未命名项目"} - 采集确认单项目档案`;
  setStatus("");
  state.currentSnapshot = formSnapshot();
}

function formSnapshot() {
  if (!els.detailView.hidden && els.form) return JSON.stringify(collectForm());
  return "";
}

function hasUnsavedDetailChanges() {
  return !els.detailView.hidden && state.currentSnapshot && formSnapshot() !== state.currentSnapshot;
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

function collectRoomSummary(form) {
  return {
    roomCount: nullableNumber(form.get("totalPrivateRoomCount")),
    minPeople: nullableNumber(form.get("roomMinPeople")),
    maxPeople: nullableNumber(form.get("roomMaxPeople"))
  };
}

function collectForm(overrides = {}) {
  const form = new FormData(els.form);
  return normalizeProject({
    ...emptyProject(),
    ...state.currentProject,
    id: els.projectId.value || state.currentProject.id || "",
    restaurantName: form.get("restaurantName")?.trim() || null,
    resource_code: form.get("resource_code")?.trim() || "",
    custom_code: form.get("custom_code")?.trim() || "",
    totalPrivateRoomCount: form.get("totalPrivateRoomCount")?.trim() || null,
    projectNotes: form.get("projectNotes")?.trim() || null,
    warnings: state.currentProject.warnings || [],
    overallConfidence: state.currentProject.overallConfidence ?? null,
    basics: collectBasics(),
    roomBooking: collectBooking(),
    privateRoomSummary: collectRoomSummary(form),
    privateRooms: [],
    sourceImages: state.currentProject.sourceImages || [],
    createdAt: state.currentProject.createdAt,
    ...overrides
  });
}

function getFilteredProjects() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  return state.projects.filter((project) => {
    if (!keyword) return true;
    return JSON.stringify(project).toLowerCase().includes(keyword);
  });
}

function projectRemarksHtml(project) {
  const remarks = normalizeRemarks(project.remarks);
  const list = remarks.length
    ? remarks.map((remark, index) => `
      <div class="remark-item">
        <b>备注${index + 1}</b>
        <span>${escapeHtml(remark.text || remark.field || "")}</span>
        <button class="remark-delete" data-action="delete-remark" data-id="${escapeHtml(project.id)}" data-remark-index="${index}" type="button" title="删除备注">×</button>
      </div>
    `).join("")
    : "";

  return `
    <div class="remark-list">${list}</div>
    <div class="remark-editor">
      <input data-remark-text type="text" placeholder="备注内容">
      <button data-action="add-remark" data-id="${escapeHtml(project.id)}" type="button">添加</button>
    </div>
  `;
}

function renderHome() {
  const filtered = getFilteredProjects();
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.currentPage = Math.min(Math.max(1, state.currentPage), pageCount);
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  els.recordCount.textContent = `${filtered.length} 条`;
  els.projectTableBody.innerHTML = visible.length ? "" : '<tr><td colspan="6" class="empty-cell">暂无项目记录</td></tr>';

  visible.forEach((project, index) => {
    const row = document.createElement("tr");
    row.className = project.starred ? "is-starred" : "";
    row.dataset.id = project.id;
    row.innerHTML = `
      <td class="col-index">${start + index + 1}</td>
      <td>
        <button class="project-link" data-action="open-project" data-id="${escapeHtml(project.id)}" type="button">
          ${project.starred ? '<span class="row-star">★</span>' : ""}
          ${escapeHtml(project.restaurantName || "未命名项目")}
        </button>
      </td>
      <td class="col-status"><span class="status-badge ${project.status === "已审核" ? "confirmed" : "pending"}">${project.status}</span></td>
      <td class="col-area-status"><span class="status-badge ${project.areaInfoStatus === "已填写" ? "confirmed" : "pending"}">${project.areaInfoStatus}</span></td>
      <td class="col-actions">
        <button class="area-action" data-action="area-info" data-id="${escapeHtml(project.id)}" type="button">区域信息对照</button>
        <button class="star-button ${project.starred ? "active" : ""}" data-action="toggle-star" data-id="${escapeHtml(project.id)}" type="button" title="星标">${project.starred ? "★ 已星标" : "☆ 星标"}</button>
        <button data-action="copy-json" data-id="${escapeHtml(project.id)}" type="button">复制 JSON</button>
      </td>
      <td class="col-remarks">${projectRemarksHtml(project)}</td>
    `;
    els.projectTableBody.append(row);
  });

  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  els.pagination.innerHTML = "";
  if (pageCount <= 1) {
    els.pagination.innerHTML = '<span>每页 30 条</span>';
    return;
  }

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "上一页";
  prev.disabled = state.currentPage === 1;
  prev.addEventListener("click", () => {
    state.currentPage -= 1;
    renderHome();
  });

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "下一页";
  next.disabled = state.currentPage === pageCount;
  next.addEventListener("click", () => {
    state.currentPage += 1;
    renderHome();
  });

  const summary = document.createElement("span");
  summary.textContent = `第 ${state.currentPage} / ${pageCount} 页，每页 30 条`;
  els.pagination.append(prev, summary, next);
}

function routeToHome() {
  if (location.hash !== "#/") location.hash = "#/";
  else renderRoute();
}

function routeToProject(id) {
  location.hash = `#/project/${encodeURIComponent(id)}`;
}

function routeToArea(id) {
  location.hash = `#/area/${encodeURIComponent(id)}`;
}

function setTopbarMode(mode) {
  const isHome = mode === "home";
  els.topbar.classList.toggle("compact", !isHome);
  els.topbarIntro.hidden = !isHome;
  els.backHomeBtn.hidden = isHome;
  els.newProjectBtn.hidden = !isHome;
  els.exportJsonBtn.hidden = !isHome;
  els.exportCsvBtn.hidden = !isHome;
}

function renderRoute() {
  const areaMatch = location.hash.match(/^#\/area\/(.+)$/);
  if (areaMatch) {
    const id = decodeURIComponent(areaMatch[1]);
    const project = state.projects.find((item) => item.id === id);
    if (project) {
      ensureAreaView();
      els.homeView.hidden = true;
      els.detailView.hidden = true;
      els.areaView.hidden = false;
      setTopbarMode("area");
      renderAreaPage(project);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
  }

  const match = location.hash.match(/^#\/project\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const project = state.projects.find((item) => item.id === id);
    if (project) {
      if (els.areaView) els.areaView.hidden = true;
      els.homeView.hidden = true;
      els.detailView.hidden = false;
      setTopbarMode("detail");
      renderForm(project);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
  }

  els.homeView.hidden = false;
  els.detailView.hidden = true;
  if (els.areaView) els.areaView.hidden = true;
  setTopbarMode("home");
  document.title = "采集确认单项目档案";
  renderHome();
}

function findProject(id) {
  return state.projects.find((project) => project.id === id);
}

async function saveProjectObject(project) {
  const { project: saved, projects } = await requestJson("/api/projects", {
    method: "POST",
    body: JSON.stringify({ project })
  });
  state.projects = projects.map(normalizeProject);
  return normalizeProject(saved);
}

async function saveCurrentFormData({ navigateToProject = false } = {}) {
  if (state.isSaving) return state.currentProject;
  state.isSaving = true;
  els.saveProjectBtn.disabled = true;
  els.saveProjectBtn.classList.add("loading");
  const originalText = els.saveProjectBtn.textContent;
  els.saveProjectBtn.textContent = "保存中...";
  try {
    const saved = await saveProjectObject(collectForm());
    renderForm(saved);
    renderHome();
    showToast("保存完毕");
    if (navigateToProject && !location.hash.includes(saved.id)) routeToProject(saved.id);
    return saved;
  } catch (error) {
    setStatus(error.message, "error");
    throw error;
  } finally {
    state.isSaving = false;
    els.saveProjectBtn.disabled = false;
    els.saveProjectBtn.classList.remove("loading");
    els.saveProjectBtn.textContent = originalText;
  }
}

async function saveCurrentForm(event) {
  event.preventDefault();
  try {
    await saveCurrentFormData({ navigateToProject: true });
  } catch {
    // Error is already shown next to the form.
  }
}

async function confirmCurrentProject() {
  if (!els.projectId.value) {
    setStatus("请先保存项目，再标记审核完毕。", "error");
    return;
  }
  const confirmed = await showModal({
    title: "审核完毕",
    message: "确认这条项目已经审核完毕？",
    confirmText: "确认"
  });
  if (!confirmed) return;

  try {
    const saved = await saveProjectObject(collectForm({ status: "已审核" }));
    renderForm(saved);
    renderHome();
    showToast("审核状态已更新");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function markAreaFilled() {
  const project = findProject(state.currentProject.id);
  if (!project) return;
  const confirmed = await showModal({
    title: "填写完毕",
    message: "确认该项目区域信息已经填写完毕？",
    confirmText: "确认"
  });
  if (!confirmed) return;

  try {
    const saved = await saveProjectObject({ ...project, areaInfoStatus: "已填写" });
    state.currentProject = saved;
    renderHome();
    renderAreaPage(saved);
    showToast("区域信息已填写");
  } catch (error) {
    els.areaStatus.textContent = error.message;
    els.areaStatus.className = "status error";
  }
}

async function deleteCurrentProject() {
  const id = els.projectId.value;
  if (!id) return;
  const confirmed = await showModal({
    title: "删除记录",
    message: "确认删除这条项目记录？删除后无法恢复。",
    confirmText: "删除",
    danger: true
  });
  if (!confirmed) return;

  try {
    const { projects } = await requestJson(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.projects = projects.map(normalizeProject);
    routeToHome();
    renderHome();
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

function safeFilename(name) {
  return fieldValue(name || "审核结果").replace(/[\\/:*?"<>|]/g, "_").trim() || "审核结果";
}

function exportJson() {
  download(`${safeFilename(state.packageName)}.json`, JSON.stringify(state.projects, null, 2), "application/json;charset=utf-8");
}

function csvCell(value) {
  return `"${fieldValue(value).replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ["餐厅名称", "resource_code", "custom_code", "审核状态", "区域信息", "星标", "备注", "包间数量", "适用人数最少", "适用人数最多", "餐厅基础信息", "包间预订"];
  const rows = state.projects.map((project) => [
    project.restaurantName,
    project.resource_code,
    project.custom_code,
    project.status,
    project.areaInfoStatus,
    project.starred ? "是" : "否",
    (project.remarks || []).map((remark, index) => `备注${index + 1}:${remark.field || ""}-${remark.text || ""}`).join("；"),
    project.privateRoomSummary?.roomCount ?? project.totalPrivateRoomCount,
    project.privateRoomSummary?.minPeople,
    project.privateRoomSummary?.maxPeople,
    (project.basics || []).map((item) => `${item.field || ""}:${fieldValue(item.selectedValues)}`).join("；"),
    Object.entries(project.roomBooking || {}).map(([key, value]) => `${key}:${fieldValue(value)}`).join("；")
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  download(`${safeFilename(state.packageName)}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

async function copyProjectJson(id) {
  const project = findProject(id);
  if (!project) return;
  await navigator.clipboard.writeText(JSON.stringify(project, null, 2));
}

async function toggleStar(id) {
  const project = findProject(id);
  if (!project) return;
  const saved = await saveProjectObject({ ...project, starred: !project.starred });
  if (state.currentProject.id === saved.id) state.currentProject = saved;
  renderHome();
}

async function addRemarkFromRow(row) {
  const id = row.dataset.id;
  const project = findProject(id);
  if (!project) return;
  const textInput = row.querySelector("[data-remark-text]");
  const text = textInput.value.trim();
  if (!text) return;

  await saveProjectObject({
    ...project,
    remarks: [...normalizeRemarks(project.remarks), { field: "", text }]
  });
  renderHome();
}

async function deleteRemark(id, index) {
  const project = findProject(id);
  if (!project) return;
  const remarks = normalizeRemarks(project.remarks).filter((_, remarkIndex) => remarkIndex !== Number(index));
  await saveProjectObject({ ...project, remarks });
  renderHome();
}

function createNewProject() {
  const project = normalizeProject(emptyProject());
  renderForm(project);
  els.homeView.hidden = true;
  els.detailView.hidden = false;
  setTopbarMode("detail");
  history.replaceState(null, "", "#/new");
}

async function handleBackHome() {
  if (hasUnsavedDetailChanges()) {
    const shouldSave = await showModal({
      title: "未保存内容",
      message: "您有信息尚未保存，是否返回首页？",
      confirmText: "保存",
      cancelText: "取消"
    });
    if (shouldSave) {
      try {
        await saveCurrentFormData();
      } catch {
        return;
      }
    }
  }
  routeToHome();
}

async function loadProjects() {
  const packageInfo = await requestJson("/api/package-info").catch(() => ({}));
  state.packageName = packageInfo.packageName || state.packageName;
  const { projects } = await requestJson("/api/projects");
  state.projects = projects.map(normalizeProject);
  renderRoute();
}

initializeOptionGroups();

els.form.addEventListener("submit", saveCurrentForm);
els.form.addEventListener("input", (event) => {
  if (!event.target.matches("[data-project-name-input]")) return;
  for (const input of els.form.querySelectorAll("[data-project-name-input]")) {
    if (input !== event.target) input.value = event.target.value;
  }
});
els.searchInput.addEventListener("input", () => {
  state.currentPage = 1;
  renderHome();
});
els.backHomeBtn.addEventListener("click", handleBackHome);
els.newProjectBtn.addEventListener("click", createNewProject);
els.exportJsonBtn.addEventListener("click", exportJson);
els.exportCsvBtn.addEventListener("click", exportCsv);
els.deleteProjectBtn.addEventListener("click", deleteCurrentProject);
els.confirmProjectBtn.addEventListener("click", confirmCurrentProject);

els.projectTableBody.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;
  const row = actionButton.closest("tr");

  try {
    if (action === "open-project") routeToProject(id);
    if (action === "area-info") routeToArea(id);
    if (action === "copy-json") await copyProjectJson(id);
    if (action === "toggle-star") await toggleStar(id);
    if (action === "add-remark") await addRemarkFromRow(row);
    if (action === "delete-remark") await deleteRemark(id, actionButton.dataset.remarkIndex);
  } catch (error) {
    showToast(error.message || "操作失败。");
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  if (button.dataset.add === "basic") addBasicRow();
});

window.addEventListener("hashchange", renderRoute);
loadProjects().catch((error) => {
  els.homeView.hidden = false;
  els.detailView.hidden = true;
  showModal({
    title: "加载失败",
    message: error.message || "项目数据加载失败。",
    confirmText: "知道了"
  });
});
