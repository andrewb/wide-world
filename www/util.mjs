/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * @param {Number} val - The value
 * @param {Number} min - The lower boundary of the output range
 * @param {Number} max - The upper boundary of the output range
 * @returns {Number} A number in the range [min, max]
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function to2d({ x, y }) {
  return {
    x: (2 * y + x) / 2,
    y: (2 * y - x) / 2,
  };
}

export function toIso({ x, y }) {
  return {
    x: x - y,
    y: (x + y) / 2,
  };
}
