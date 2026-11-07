/** 本地进度与个人纪录读写；可注入存储适配器测试。 */
import { DIARY_KEY, RECORD_KEY, SAVE_VERSION, STORAGE_KEY } from "../config.js";

export function compareRecords(a, b) {
  const aEscaped = Boolean(a && a.escaped);
  const bEscaped = Boolean(b && b.escaped);
  if (aEscaped !== bEscaped) return aEscaped ? -1 : 1;
  if (aEscaped && bEscaped) {
    return (a.steps - b.steps) || ((b.explored || 0) - (a.explored || 0));
  }
  return (b.steps - a.steps) || ((b.explored || 0) - (a.explored || 0));
}

export class SaveStore {
  constructor(storage) {
    this.storage = storage;
  }

  loadSavedState() {
    try {
      const value = this.storage.getItem(STORAGE_KEY);
      if (!value) return null;
      const parsed = JSON.parse(value);
      if (parsed.version !== SAVE_VERSION || !parsed.active || !parsed.maze) return null;
      return parsed;
    } catch (error) {
      console.warn("读取存档失败", error);
      return null;
    }
  }

  loadRecords() {
    try {
      const records = JSON.parse(this.storage.getItem(RECORD_KEY) || "[]");
      return Array.isArray(records)
        ? records.filter((record) => record && Number.isFinite(record.steps))
          .sort(compareRecords)
        : [];
    } catch (error) {
      return [];
    }
  }

  completeRun(record) {
    this.storage.removeItem(STORAGE_KEY);
    const records = this.loadRecords();
    records.push(record);
    records.sort(compareRecords);
    this.storage.setItem(RECORD_KEY, JSON.stringify(records.slice(0, 20)));
  }

  loadSeenDiaryVersion() {
    try {
      const value = this.storage.getItem(DIARY_KEY);
      return value ? String(value) : null;
    } catch (error) {
      return null;
    }
  }

  saveSeenDiaryVersion(version) {
    try {
      this.storage.setItem(DIARY_KEY, String(version));
    } catch (error) {
      console.warn("保存开发者日记进度失败", error);
    }
  }

  save(state) {
    if (!state || !state.active) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("保存进度失败", error);
    }
  }

}
