/** 无副作用的数值辅助函数。 */


export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
