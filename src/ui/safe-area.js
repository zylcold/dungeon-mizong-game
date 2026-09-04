/** 宿主安全区与视口测量。 */
import { MOBILE_SAFE_TOP_FALLBACK } from "../config.js";

export function parsePixelValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function measureSafeAreaTop() {
  let injectedInset = 0;
  let environmentInset = 0;
  let viewportInset = 0;
  const root = document.documentElement;
  if (root && typeof window.getComputedStyle === "function") {
    const rootStyle = window.getComputedStyle(root);
    if (rootStyle && typeof rootStyle.getPropertyValue === "function") {
      injectedInset = parsePixelValue(rootStyle.getPropertyValue("--safe-area-inset-top"));
    }
  }
  if (document.body && typeof window.getComputedStyle === "function") {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);pointer-events:none";
    document.body.appendChild(probe);
    environmentInset = parsePixelValue(window.getComputedStyle(probe).paddingTop);
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  }
  if (window.visualViewport && Number.isFinite(window.visualViewport.offsetTop)) {
    viewportInset = Math.max(0, window.visualViewport.offsetTop);
  }
  const coarsePointer = typeof window.matchMedia === "function"
    && window.matchMedia("(pointer: coarse)").matches;
  const compactWidth = Number.isFinite(window.innerWidth) && window.innerWidth <= 760;
  const mobileFallback = coarsePointer && compactWidth ? MOBILE_SAFE_TOP_FALLBACK : 0;
  return Math.max(injectedInset, environmentInset, viewportInset, mobileFallback);
}
