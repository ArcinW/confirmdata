import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `未找到源码起点：${start}`);
  assert.notEqual(endIndex, -1, `未找到源码终点：${end}`);
  return appSource.slice(startIndex, endIndex);
}

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

const context = vm.createContext({
  console,
  crypto,
  Date,
  JSON,
  Map,
  Promise,
  localStorage,
  window: {
    __PROJECT_BOOTSTRAP__: {
      packageInfo: { packageName: "美团301-400" },
      projects: [{ id: "不应载入的301批次项目" }]
    }
  }
});

vm.runInContext(`
  const state = { packageName: "审核结果", projects: [] };
  const localStorePrefix = "confirmdata";
  ${sourceBetween("function bootstrapPackageName()", "function requestJson(")}
  ${sourceBetween("function projectsJsonContent()", "function exportJson(")}
  this.testApi = {
    readLocalProjects,
    writeLocalProjects,
    localApi,
    exportCurrent() { return projectsJsonContent(); },
    setStateProjects(projects) { state.projects = projects; }
  };
`, context);

const { testApi } = context;

// 即使旧构建产物内带有其他批次，首次打开也必须为空。
assert.deepEqual(Array.from(testApi.readLocalProjects()), []);

// 模拟一次导入 1-100：完整数组覆盖缓存。
const imported = Array.from({ length: 100 }, (_, index) => ({
  id: `project-${index + 1}`,
  status: "待审核"
}));
testApi.writeLocalProjects(imported);

// 模拟关闭并重新打开：应从同一 localStorage 恢复完整的 100 条。
let reopened = Array.from(testApi.readLocalProjects(), (project) => ({ ...project }));
assert.equal(reopened.length, 100);
assert.equal(reopened.some((project) => project.id === "不应载入的301批次项目"), false);

// 模拟审核并保存前 50 条。每次保存后，整包仍必须保持 100 条。
for (let index = 0; index < 50; index += 1) {
  const result = await testApi.localApi("/api/projects", {
    method: "POST",
    body: JSON.stringify({ project: { ...reopened[index], status: "已审核" } })
  });
  reopened = Array.from(result.projects, (project) => ({ ...project }));
  assert.equal(reopened.length, 100);
}

// 导出使用 state.projects 全量数据：50 条已审核 + 50 条待审核，总数仍为 100。
testApi.setStateProjects(reopened);
const exported = JSON.parse(testApi.exportCurrent());
assert.equal(exported.length, 100);
assert.equal(exported.filter((project) => project.status === "已审核").length, 50);
assert.equal(exported.filter((project) => project.status === "待审核").length, 50);
assert.equal(exported.some((project) => project.id === "不应载入的301批次项目"), false);

const bootstrapSource = fs.readFileSync(new URL("../public/bootstrap-data.js", import.meta.url), "utf8");
const bootstrapContext = vm.createContext({ window: {} });
vm.runInContext(bootstrapSource, bootstrapContext);
assert.deepEqual(Array.from(bootstrapContext.window.__PROJECT_BOOTSTRAP__.projects), []);

console.log("本地缓存与整包导出测试通过：首次 0 条，重开 100 条，审核 50 条后仍导出 100 条。 ");
