// The ink well at the foot of every page: the pointer stirs ripples into its surface and
// now and then a drop falls. Only light and shade move; the text above stays still.
// ponytail: a 2D height field at 1/5 resolution, upscaled by the browser; fine for a band
// this size, switch to WebGL if the well ever covers the whole viewport.
const CELL = 5;
const DAMP = 0.982;
const DRIP_MS = 2600;
const GLINT = 0.7;
const GLINT_RGB = [246, 238, 222];
const SHADE_RGB = [0, 2, 12];

const well = {
  root: null,
  ctx: null,
  width: 0,
  height: 0,
  current: null,
  previous: null,
  image: null,
  frame: 0,
  visible: false,
  lastDrip: 0,
  pointer: null,
};

// A well that isn't laid out yet (zero size) gets its buffers on the next resize or reveal.
const resize = () => {
  const canvas = well.ctx.canvas;
  well.width = Math.ceil(well.root.clientWidth / CELL);
  well.height = Math.ceil(well.root.clientHeight / CELL);
  if (!well.width || !well.height) {
    well.image = null;
    return;
  }
  canvas.width = well.width;
  canvas.height = well.height;
  well.current = new Float32Array(well.width * well.height);
  well.previous = new Float32Array(well.width * well.height);
  well.image = well.ctx.createImageData(well.width, well.height);
};

const drop = (cx, cy, radius, strength) => {
  const { width, height, previous } = well;
  for (let y = Math.max(1, cy - radius); y < Math.min(height - 1, cy + radius); y += 1) {
    for (let x = Math.max(1, cx - radius); x < Math.min(width - 1, cx + radius); x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < radius) {
        previous[y * width + x] += (strength * (Math.cos((d / radius) * Math.PI) + 1)) / 2;
      }
    }
  }
};

// One step of the classic two-buffer wave equation.
const step = () => {
  const { width, height, current, previous } = well;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      previous[i] =
        ((current[i - 1] + current[i + 1] + current[i - width] + current[i + width]) / 2 -
          previous[i]) *
        DAMP;
    }
  }
  well.current = previous;
  well.previous = current;
};

// Slopes facing the light glint like wet ink; slopes facing away darken.
const paint = (data, offset, rgb, alpha) => {
  data[offset] = rgb[0];
  data[offset + 1] = rgb[1];
  data[offset + 2] = rgb[2];
  data[offset + 3] = alpha;
};

const render = () => {
  const { width, height, current, image } = well;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const shade =
        (current[i - 1] - current[i + 1]) * 0.7 + (current[i - width] - current[i + width]) * 0.9;
      if (shade > 0) {
        paint(image.data, i * 4, GLINT_RGB, Math.min(255, shade * 255 * GLINT));
      } else {
        paint(image.data, i * 4, SHADE_RGB, Math.min(150, -shade * 200));
      }
    }
  }
  well.ctx.putImageData(image, 0, 0);
};

const tick = (now) => {
  well.frame = 0;
  if (!well.image) {
    resize();
  }
  if (!well.image) {
    return;
  }
  if (now - well.lastDrip > DRIP_MS) {
    well.lastDrip = now;
    const x = 2 + Math.floor(Math.random() * (well.width - 4));
    const y = 2 + Math.floor(Math.random() * (well.height - 4));
    drop(x, y, 5, 1.4);
  }
  step();
  render();
  if (well.visible) {
    well.frame = requestAnimationFrame(tick);
  }
};

// Drag a wake along the pointer's path, not just where it lands each event.
const stir = (event) => {
  if (!well.image) {
    return;
  }
  const rect = well.root.getBoundingClientRect();
  const x = (event.clientX - rect.left) / CELL;
  const y = (event.clientY - rect.top) / CELL;
  const last = well.pointer;
  if (last) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x - last.x, y - last.y) / 2));
    for (let k = 1; k <= steps; k += 1) {
      const px = last.x + ((x - last.x) * k) / steps;
      const py = last.y + ((y - last.y) * k) / steps;
      drop(Math.round(px), Math.round(py), 3, 0.5);
    }
  }
  well.pointer = { x, y };
};

export const initInkWell = () => {
  const root = document.querySelector('[data-ink-well]');
  const canvas = root?.querySelector('.ink-well-water');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  well.root = root;
  well.ctx = canvas.getContext('2d');
  resize();
  root.addEventListener('pointermove', stir);
  root.addEventListener('pointerleave', () => {
    well.pointer = null;
  });
  window.addEventListener('resize', resize);
  new IntersectionObserver(([entry]) => {
    well.visible = entry.isIntersecting;
    if (well.visible && !well.frame) {
      well.frame = requestAnimationFrame(tick);
    }
  }).observe(root);
};
