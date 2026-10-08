// Маленький «Aseprite в коде»: рисуем пиксель-арт фигурами, потом автоматически
// добавляем светотень, контур и рельеф (карту нормалей) — чтобы спрайт освещался фонарями.

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

export class PixelSheet {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.color = new Array(width * height).fill(null); // [r,g,b] или null (прозрачно)
    this.glow = new Uint8Array(width * height);          // 1 — пиксель светится
  }

  // Рисовалка одного кадра: координаты внутри кадра, flip — зеркально по горизонтали
  // remap(x, y, color, glow) → [x, y, color, glow] — перерисовать каждый пиксель по-своему (например, засушить растение)
  frame(col, row, frameW, frameH, flip = false, remap = null) {
    const ox = col * frameW;
    const oy = row * frameH;
    const sheet = this;
    sheet.frameW = frameW; // размер кадра — чтобы светотень и контур не переходили в соседний кадр
    sheet.frameH = frameH;
    const put = (x, y, color, glow) => {
      if (remap && color) [x, y, color, glow] = remap(x, y, typeof color === 'string' ? hex(color) : color, glow);
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= frameW || y >= frameH) return;
      const px = flip ? frameW - 1 - x : x;
      const i = (oy + y) * sheet.width + ox + px;
      sheet.color[i] = typeof color === 'string' ? hex(color) : color; // null — стереть
      sheet.glow[i] = glow ? 1 : 0;
    };
    return {
      px: (x, y, c, glow) => put(x, y, c, glow),
      rect(x, y, w, h, c, glow) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, glow);
      },
      ellipse(cx, cy, rx, ry, c, glow) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x - cx) / (rx + 0.5);
            const dy = (y - cy) / (ry + 0.5);
            if (dx * dx + dy * dy <= 1) put(x, y, c, glow);
          }
        }
      },
      line(x0, y0, x1, y1, c, glow) {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) put(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, c, glow);
      },
    };
  }

  // Светотень: свет сверху-слева — верхние края светлее, нижние темнее; потом контур снаружи
  finish() {
    const { width: w, height: h } = this;
    const fw = this.frameW || w;
    const fh = this.frameH || h;
    // соседний пиксель — только внутри того же кадра (иначе контур из кадра сверху ложится полоской на кадр снизу)
    const sameFrame = (x, y, nx, ny) => Math.floor(x / fw) === Math.floor(nx / fw) && Math.floor(y / fh) === Math.floor(ny / fh);
    const inside = (x, y, nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && sameFrame(x, y, nx, ny);
    const at = (x, y, nx, ny) => (inside(x, y, nx, ny) ? this.color[ny * w + nx] : null);
    const shaded = this.color.map((c, i) => {
      if (!c) return null;
      const x = i % w;
      const y = Math.floor(i / w);
      const same = (o) => o && o[0] === c[0] && o[1] === c[1] && o[2] === c[2];
      if (!same(at(x, y, x, y - 1)) || !same(at(x, y, x - 1, y))) return shade(c, 1.18); // край, на который падает свет
      if (!same(at(x, y, x, y + 1)) || !same(at(x, y, x + 1, y))) return shade(c, 0.78); // край в тени
      return c;
    });
    // Контур: прозрачный пиксель рядом с рисунком становится тёмным оттенком соседа
    const outlined = shaded.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (shaded[y * w + x]) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => at(x, y, x + dx, y + dy))
          .find(Boolean);
        if (n) outlined[y * w + x] = shade(n, 0.3);
      }
    }
    this.color = outlined;
    return this;
  }

  toCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(this.width, this.height);
    this.color.forEach((c, i) => {
      if (!c) return;
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    });
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  glowCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(this.width, this.height);
    this.glow.forEach((g, i) => {
      const c = this.color[i];
      if (g && c) img.data.set([c[0], c[1], c[2], 255], i * 4);
      else img.data.set([0, 0, 0, 255], i * 4);
    });
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

// Рельеф спрайта из его формы: чем дальше пиксель от края рисунка, тем «выше» (подушка),
// плюс немного яркости — складки. Работает и для твоих картинок (по прозрачности).
export function spriteNormalCanvas(sourceCanvas) {
  const { width: w, height: h } = sourceCanvas;
  const src = sourceCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 127;
  // расстояние до края (до 4 пикселей) — простой проход «волной»
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dist[y * w + x] = opaque(x, y) ? 99 : 0;
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!dist[i]) continue;
        const m = Math.min(
          x > 0 ? dist[i - 1] : 0, x < w - 1 ? dist[i + 1] : 0,
          y > 0 ? dist[i - w] : 0, y < h - 1 ? dist[i + w] : 0,
        );
        dist[i] = Math.min(dist[i], m + 1);
      }
    }
  }
  const height = (x, y) => {
    if (!opaque(x, y)) return 0;
    const i = y * w + x;
    const lum = (src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]) / 765;
    return Math.min(dist[i], 4) / 4 + lum * 0.25;
  };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * 1.5;
      // + наклон вверх: спрайт стоит «стоя», а так он ловит свет неба сверху, как земля вокруг
      const dy = (height(x, y + 1) - height(x, y - 1)) * 1.5 + 0.7;
      const len = Math.hypot(dx, dy, 1);
      img.data.set([(-dx / len * 0.5 + 0.5) * 255, (dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255, 255], (y * w + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
