/** 图集加载与 DOM 图标定位。 */
import { SPRITE_ATLAS } from "../data/atlas.js";

export class AssetStore {
  constructor(url, onUpdate) {
    this.image = new Image();
    this.image.onload = onUpdate;
    this.image.onerror = onUpdate;
    this.image.src = url;
  }

  get() {
    const image = this.image;
    return image && image.complete && image.naturalWidth > 0 ? image : null;
  }
}

export function applyAtlasFrame(element, assetKey) {
  const frame = SPRITE_ATLAS.frames[assetKey] || SPRITE_ATLAS.frames["event-map"];
  const x = frame[0] * (100 / (SPRITE_ATLAS.columns - 1));
  const y = frame[1] * (100 / (SPRITE_ATLAS.rows - 1));
  element.dataset.sprite = assetKey;
  element.style.backgroundPosition = `${x}% ${y}%`;
}
