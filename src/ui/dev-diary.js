/** 开发者日记：新版本首次进入自动展示更新内容，开始界面可随时回看。 */
import { APP_VERSION } from "../config.js";
import { DEV_DIARY, DIARY_ITEM_LABELS } from "../data/dev-diary.js";
import { replaceChildrenCompat } from "./dom.js";

export class DevDiary {
  constructor(game) {
    this.game = game;
    this.dom = game.dom;
    this.renderList();
  }

  renderList() {
    replaceChildrenCompat(this.dom.diaryList, DEV_DIARY.map((entry) => {
      const section = document.createElement("article");
      section.className = "diary-entry";
      const head = document.createElement("header");
      head.className = "diary-entry-head";
      const meta = document.createElement("div");
      meta.className = "diary-entry-meta";
      const version = document.createElement("strong");
      version.className = "diary-version";
      version.textContent = `v${entry.version}`;
      const date = document.createElement("span");
      date.className = "diary-date";
      date.textContent = entry.date;
      meta.appendChild(version);
      meta.appendChild(date);
      const title = document.createElement("h3");
      title.textContent = entry.title;
      head.appendChild(meta);
      head.appendChild(title);
      const list = document.createElement("ul");
      entry.items.forEach((item) => {
        const row = document.createElement("li");
        row.className = `diary-item diary-item-${item.kind}`;
        const kind = document.createElement("span");
        kind.className = "diary-kind";
        kind.textContent = DIARY_ITEM_LABELS[item.kind] || "更新";
        const text = document.createElement("span");
        text.textContent = item.text;
        row.appendChild(kind);
        row.appendChild(text);
        list.appendChild(row);
      });
      section.appendChild(head);
      section.appendChild(list);
      return section;
    }));
  }

  show(markSeen = true) {
    this.dom.diaryOverlay.hidden = false;
    if (markSeen) this.game.storage.saveSeenDiaryVersion(APP_VERSION);
  }

  close() {
    this.dom.diaryOverlay.hidden = true;
  }

  maybeShowOnLaunch() {
    const seen = this.game.storage.loadSeenDiaryVersion();
    // 新玩家没有“上一个版本”，不自动弹日记，只提供入口；老玩家升级后首次进入自动展示。
    if (seen && seen !== APP_VERSION) this.show();
  }
}
