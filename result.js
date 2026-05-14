const {
  STORAGE,
  profiles,
  calculateResults,
  questions,
  getProfileRarityLabel,
  getProfileRarityRating,
  getProfileEaseRating,
  parseResultLinkParams,
  buildResultQueryString,
} = window.CPTI_DATA;



const resultEmpty = document.querySelector('#result-empty');
const resultView = document.querySelector('#result-view');
const formulaTitle = document.querySelector('#formula-title');
const formulaSummary = document.querySelector('#formula-summary');
const resultHeadingSummary = document.querySelector('#result-heading-summary');
const resultHeroCast = document.querySelector('#result-hero-cast');



const selfResult = document.querySelector('#self-result');
const needResult = document.querySelector('#need-result');
const resultTags = document.querySelector('#result-tags');
const resultNote = document.querySelector('#result-note');
const floatingShareActions = document.querySelector('#floating-share-actions');
const shareButton = document.querySelector('#share-result');
const matchShareButton = document.querySelector('#share-match-result');
const shareModal = document.querySelector('#share-modal');

const shareBackdrop = document.querySelector('#share-backdrop');
const shareClose = document.querySelector('#share-close');
const shareGallery = document.querySelector('#share-gallery');
const shareTrack = document.querySelector('#share-track');
const shareIndicators = document.querySelector('#share-indicators');
const sharePrevButton = document.querySelector('#share-prev');
const shareNextButton = document.querySelector('#share-next');
const profileCatalog = document.querySelector('#profile-catalog');
const restartButton = document.querySelector('#restart-result');
const resultEmptyTitle = document.querySelector('#result-empty-title');
const resultEmptyCopy = document.querySelector('#result-empty-copy');
const resultCatalogIntro = document.querySelector('#result-catalog-intro');

let lastComputed = null;
let autoShareOpened = false;
let shareModalSlides = [];
let activeShareSlideIndex = 0;
let shareAssetCache = null;
let shareAssetPromises = null;
let shareTouchStartX = null;
let shareCarouselTimer = null;
let shareCarouselPaused = false;
let shareCarouselHoldTimer = null;
let shareCarouselHoldActive = false;
let shareCarouselHoldStartX = 0;
let shareCarouselHoldStartY = 0;
const SHARE_CAROUSEL_INTERVAL_MS = 5000;
const SHARE_CAROUSEL_PAUSE_HOLD_MS = 450;
const SHARE_AVATAR_FRAME_SIDES = 6;

const getResultPageShareUrl = (computed) => {
  const qs = buildResultQueryString(computed);
  if (!qs) return 'https://cpti.cc/';
  try {
    return new URL(`result.html?${qs}`, window.location.href).href;
  } catch {
    return `https://cpti.cc/result.html?${qs}`;
  }
};

const syncCanonicalUrl = (computed) => {
  const qs = buildResultQueryString(computed);
  if (!qs) return;
  const url = new URL(window.location.href);
  const next = `?${qs}`;
  if (url.search === next) return;
  url.search = qs;
  history.replaceState(null, '', `${url.pathname}${next}${url.hash}`);
};





const loadPayload = () => {
  try {
    const raw = localStorage.getItem(STORAGE.resultKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const showEmptyState = (reason = 'default') => {
  resultEmpty?.classList.remove('hidden');
  resultView?.classList.add('hidden');
  floatingShareActions?.classList.add('hidden');
  if (resultEmptyTitle) {
    resultEmptyTitle.textContent = reason === 'badlink' ? '链接里的结果无效' : '还没有可展示的结果';
  }
  if (resultEmptyCopy) {
    resultEmptyCopy.textContent = reason === 'badlink'
      ? '参数可能写错或人格类型已更新。你可以重新测试，或请朋友重新复制分享链接。'
      : '先去测试页做完题，或让朋友发你带参数的分享链接。';
  }
};

const clearDataAndRestart = () => {
  const confirmed = window.confirm('确认清空当前结果并重新开始测试吗？这会删除当前测试进度和结果记录。');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE.resultKey);
  localStorage.removeItem(STORAGE.progressKey);
  window.location.href = './quiz.html';
};


const setFloatingButtonLabel = (button, text) => {
  if (!button) return;
  const label = button.querySelector('.floating-share-label');
  if (label) {
    label.textContent = text;
    return;
  }
  button.textContent = text;
};

const avatarHtml = (profile, size = 'large') => `

  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${profile.avatarImage}" alt="${profile.name} 头像" loading="lazy" />
  </div>
`;

const heroCastAvatarHtml = (profile, positionClass) => `
  <div class='result-hero-character ${positionClass}'>
    <div class='result-hero-character-bob'>
      <div class='avatar-shell small result-hero-avatar' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
        <img src="${profile.avatarImage}" alt="${profile.name} 头像" loading="lazy" />
      </div>
    </div>
  </div>
`;

const renderResultHeroCast = (selfProfile, needProfile) => {
  if (!resultHeroCast) return;
  if (!selfProfile || !needProfile) {
    resultHeroCast.innerHTML = '';
    return;
  }

  resultHeroCast.removeAttribute('hidden');
  resultHeroCast.innerHTML = `
    ${heroCastAvatarHtml(selfProfile, 'is-left')}
    <span class='result-hero-heart' aria-hidden='true'>❤</span>
    ${heroCastAvatarHtml(needProfile, 'is-right')}
  `;
};

const profileDetailHref = (id, source = 'result') => `./profile.html?id=${encodeURIComponent(id)}&from=${encodeURIComponent(source)}`;


const taifyCopy = (text = '') => text.replace(/你/g, 'Ta');

const renderStars = (rating, total = 5) => Array.from({ length: total }, (_, index) => (
  `<span class='detail-star ${index < rating ? 'is-active' : ''}'>★</span>`
)).join('');

const getConfidenceRating = (confidence = 0, min = 50, max = 70) => {
  const safeConfidence = Number.isFinite(confidence) ? confidence : 0;
  const clamped = Math.min(max, Math.max(min, safeConfidence));
  const ratio = (clamped - min) / Math.max(1, max - min);
  return Math.max(1, Math.min(5, Math.round(1 + ratio * 4)));
};

const panelHtml = (title, profile, confidence, mode) => {

  const isNeedMode = mode === 'need';
  const description = isNeedMode ? taifyCopy(profile.description) : profile.description;
  const longDescription = isNeedMode ? taifyCopy(profile.longDescription) : profile.longDescription;
  const note = isNeedMode ? taifyCopy(profile.note) : profile.note;
  const rarityLabel = getProfileRarityLabel(profile.id);
  const rarityRating = getProfileRarityRating(profile.id);
  const easeRating = getProfileEaseRating(profile.id);
  const confidenceRating = getConfidenceRating(confidence);

  return `
    <div class='result-panel-head'>
      <span class='mini-badge'>${title}</span>
      ${avatarHtml(profile, 'large')}
      <div class='result-panel-copy'>
        <h3>${profile.name}</h3>
        <div class='result-metrics'>
          <div class='result-metric'>
            <span class='result-metric-label'>稀有度</span>
            <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
            <span class='detail-stars' aria-label='稀有度 ${rarityRating} 星'>${renderStars(rarityRating)}</span>
          </div>
          <div class='result-metric'>
            <span class='result-metric-label'>容易被拿下程度</span>
            <span class='detail-stars' aria-label='容易被拿下程度 ${easeRating} 星'>${renderStars(easeRating)}</span>
          </div>
        </div>
        <div class='result-metric is-score'>
          <span class='result-metric-label'>命中感</span>
          <span class='detail-stars' aria-label='命中感 ${confidence}% / ${confidenceRating} 星'>${renderStars(confidenceRating)}</span>
        </div>

      </div>
    </div>
    <p>${description}</p>
    ${longDescription ? `<p class='detail-copy'>${longDescription}</p>` : ''}
    <p class='panel-note'>${note}</p>
    <div class='result-tag-row'>
      <div class='tag-row compact'>
        ${profile.tags.map((tag) => `<span>${tag}</span>`).join('')}
      </div>
      <a class='result-detail-button' href='${profileDetailHref(profile.id, 'result')}' aria-label='查看 ${profile.name} 的详细恋爱人格'>查看详细恋爱人格</a>
    </div>
  `;
};






const loadImage = (src) => new Promise((resolve, reject) => {
  if (!src) {
    reject(new Error('Missing image src'));
    return;
  }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const loadRemoteImage = async (url) => {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('Failed to load remote image');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};


const getLines = (ctx, text, maxWidth) => {
  if (!text) return [];
  const words = text.split('');
  const lines = [];
  let current = '';
  words.forEach((char) => {
    const testLine = `${current}${char}`;
    if (ctx.measureText(testLine).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = testLine;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

const drawPixelPanel = (ctx, x, y, width, height, options = {}) => {
  const {
    fill = '#ffffff',
    stroke = 'rgba(85, 106, 136, 0.18)',
    shadow = '',
    shadowOffsetX = 0,
    shadowOffsetY = 10,
    shadowBlur = 24,
    lineWidth = 1.5,
    radius = 24,
  } = options;

  const panelRadius = Math.max(12, Math.min(radius, width * 0.08, height * 0.18));

  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
  }

  drawRoundedRect(ctx, x, y, width, height, panelRadius);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
};

const drawPixelGrid = (ctx, x, y, width, height, options = {}) => {
  const {
    size = 24,
    color = 'rgba(255, 255, 255, 0.06)',
    strongColor = 'rgba(125, 214, 255, 0.12)',
    majorEvery = 4,
  } = options;

  ctx.save();
  for (let offsetX = x; offsetX <= x + width; offsetX += size) {
    const isMajor = Math.round((offsetX - x) / size) % majorEvery === 0;
    ctx.fillStyle = isMajor ? strongColor : color;
    ctx.fillRect(offsetX, y, 1, height);
  }
  for (let offsetY = y; offsetY <= y + height; offsetY += size) {
    const isMajor = Math.round((offsetY - y) / size) % majorEvery === 0;
    ctx.fillStyle = isMajor ? strongColor : color;
    ctx.fillRect(x, offsetY, width, 1);
  }
  ctx.restore();
};

const drawPixelSparkles = (ctx, width, height, theme) => {
  const stars = [
    [66, 88, 6], [154, 148, 4], [286, 76, 8], [372, 172, 4], [498, 108, 6], [612, 82, 5],
    [744, 152, 7], [818, 92, 4], [116, 344, 5], [228, 288, 8], [334, 418, 4], [464, 356, 6],
    [616, 316, 4], [788, 390, 8], [126, 646, 4], [268, 728, 6], [432, 682, 8], [598, 748, 5],
    [744, 694, 7], [836, 606, 4], [122, 1062, 6], [286, 1176, 4], [486, 1128, 7], [690, 1202, 5],
  ];

  ctx.save();
  stars.forEach(([sx, sy, size]) => {
    if (sx > width - 12 || sy > height - 12) return;
    ctx.fillStyle = theme.starColor;
    ctx.fillRect(sx, sy, size, size);
    ctx.fillStyle = theme.starGlow;
    ctx.fillRect(sx - 2, sy + Math.floor(size / 2), size + 4, 2);
    ctx.fillRect(sx + Math.floor(size / 2), sy - 2, 2, size + 4);
  });
  ctx.restore();
};

const getSeed = (text = '') => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return hash || 1;
};

const createSeededRandom = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const drawLeafTexture = (ctx, x, y, width, height, options = {}) => {
  const {
    color = 'rgba(203, 170, 92, 0.16)',
    vein = 'rgba(145, 110, 36, 0.12)',
    count = 32,
    seed = 1,
  } = options;
  const rand = createSeededRandom(seed);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const leafX = x + rand() * width;
    const leafY = y + rand() * height;
    const size = 14 + rand() * 22;
    const rotation = rand() * Math.PI * 2;
    ctx.save();
    ctx.translate(leafX, leafY);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.45, size, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = vein;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.9);
    ctx.lineTo(0, size * 0.9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

const drawSakuraTexture = (ctx, x, y, width, height, options = {}) => {
  const {
    petal = 'rgba(243, 184, 206, 0.28)',
    core = 'rgba(226, 143, 177, 0.24)',
    count = 36,
    seed = 1,
  } = options;
  const rand = createSeededRandom(seed);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const centerX = x + rand() * width;
    const centerY = y + rand() * height;
    const size = 6 + rand() * 10;
    const rotation = rand() * Math.PI * 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.fillStyle = petal;
    for (let p = 0; p < 5; p += 1) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * p) / 5);
      ctx.beginPath();
      ctx.ellipse(0, size * 0.45, size * 0.42, size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

const drawRainbowTexture = (ctx, x, y, width, height, options = {}) => {
  const {
    colors = ['#ff8db1', '#ffc26b', '#fff08a', '#8fe3bd', '#85b8ff', '#b792ff'],
    alpha = 0.18,
    angle = -Math.PI / 7,
    seed = 1,
  } = options;
  const rand = createSeededRandom(seed);
  const diag = Math.sqrt(width * width + height * height);
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(-diag / 2, 0, diag / 2, 0);
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(-diag / 2, -diag / 2, diag, diag);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 30; i += 1) {
    const dotX = x + rand() * width;
    const dotY = y + rand() * height;
    const dotSize = 22 + rand() * 36;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};


const drawStar = (ctx, cx, cy, outerRadius, innerRadius, color) => {

  const step = Math.PI / 5;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * step;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

const drawStarStyled = (ctx, cx, cy, outerRadius, innerRadius, options = {}) => {
  const {
    fill = '#ffffff',
    stroke = 'rgba(255, 255, 255, 0.9)',
    strokeWidth = 2,
    glow = 'rgba(255, 255, 255, 0.6)',
    glowBlur = 10,
  } = options;

  const step = Math.PI / 5;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * step;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowBlur;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
};

const drawTcgCornerBrackets = (ctx, x, y, w, h, options = {}) => {
  const {
    stroke = 'rgba(188, 112, 142, 0.52)',
    highlight = 'rgba(255, 240, 248, 0.78)',
    len = 28,
    lw = 2.2,
  } = options;
  ctx.save();
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  const corners = [
    [x, y, 1, 0, 0, 1],
    [x + w, y, -1, 0, 0, 1],
    [x, y + h, 1, 0, 0, -1],
    [x + w, y + h, -1, 0, 0, -1],
  ];
  corners.forEach(([cx, cy, sx, sy, ex, ey]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + len * sx, cy + len * sy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + len * ex, cy + len * ey);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + len * sx, cy + len * sy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + len * ex, cy + len * ey);
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.restore();
};

const drawTcgStatPlate = (ctx, x, y, w, h, {
  label,
  value,
  sub,
  fill,
  stroke,
  primary,
  muted,
  accent,
}) => {
  drawPixelPanel(ctx, x, y, w, h, {
    fill,
    stroke,
    border: 5,
    shadow: 'rgba(0, 0, 0, 0.14)',
    shadowOffsetX: 3,
    shadowOffsetY: 5,
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 12px "Noto Sans SC", sans-serif';
  ctx.fillStyle = muted;
  ctx.fillText(label, x + w / 2, y + 22);
  ctx.font = '800 26px Outfit, "Noto Sans SC", sans-serif';
  ctx.fillStyle = primary;
  ctx.fillText(String(value), x + w / 2, y + 54);
  ctx.font = '600 11px "Noto Sans SC", sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(sub, x + w / 2, y + 74);
};

const drawOtomeBokeh = (ctx, x, y, w, h, seed, accent) => {
  const rand = createSeededRandom(seed + 901);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 24; i += 1) {
    const bx = x + rand() * w;
    const by = y + rand() * h;
    const br = 8 + rand() * 32;
    ctx.globalAlpha = 0.05 + rand() * 0.09;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, accent);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawOtomeWatermarkHearts = (ctx, cardX, cardY, cardWidth, cardHeight, accent) => {
  const spots = [
    [cardX + cardWidth * 0.2, cardY + cardHeight * 0.34],
    [cardX + cardWidth * 0.8, cardY + cardHeight * 0.66],
    [cardX + cardWidth * 0.5, cardY + cardHeight * 0.2],
  ];
  ctx.save();
  spots.forEach(([cx, cy], i) => {
    ctx.globalAlpha = 0.05 + i * 0.018;
    ctx.fillStyle = accent;
    ctx.font = '500 34px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♡', cx, cy);
  });
  ctx.restore();
};

const getEaseRating = (profile) => {
  const id = profile?.id || '';
  return getProfileEaseRating(id);
};





const getRarityRating = (profile) => {
  const id = profile?.id || '';
  return getProfileRarityRating(id);
};

const getRarityLabel = (profile) => {
  const id = profile?.id || '';
  return getProfileRarityLabel(id);
};

const drawPixelBadge = (ctx, options = {}) => {



  const {
    x,
    y,
    text,
    fill,
    stroke,
    textColor,
    shadow,
    font = '600 12px "Noto Sans SC", sans-serif',

    padX = 16,
    height = 34,
    align = 'left',
  } = options;

  ctx.save();
  ctx.font = font;
  const badgeWidth = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const drawX = align === 'right' ? x - badgeWidth : x;
  drawPixelPanel(ctx, drawX, y, badgeWidth, height, {
    fill,
    stroke,
    highlight: 'rgba(255, 255, 255, 0.12)',
    shade: 'rgba(4, 7, 15, 0.88)',
    border: 6,
    inset: 3,
    shadow,
    shadowOffsetX: 4,
    shadowOffsetY: 5,
  });
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, drawX + badgeWidth / 2, y + height / 2 + 1);
  ctx.restore();
  return badgeWidth;
};

const drawDiamondPath = (ctx, cx, cy, size) => {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half, cy);
  ctx.lineTo(cx, cy + half);
  ctx.lineTo(cx - half, cy);
  ctx.closePath();
};

const drawDiamondFrame = (ctx, cx, cy, size, options = {}) => {
  const {
    ringCount = 3,
    gap = 18,
    lineWidth = 5,
    stroke = '#ffffff',
    glow = 'rgba(255, 255, 255, 0.4)',
    ringColors,
  } = options;
  const colors = ringColors || [stroke, 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.35)'];

  for (let i = 0; i < ringCount; i += 1) {
    const ringSize = size - i * gap;
    if (ringSize <= 0) continue;
    ctx.save();
    ctx.lineWidth = Math.max(2, lineWidth - i);
    ctx.strokeStyle = colors[Math.min(i, colors.length - 1)];
    if (i === 0 && glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
    }
    drawDiamondPath(ctx, cx, cy, ringSize);
    ctx.stroke();
    ctx.restore();
  }
};

/** Regular n-gon (flat sides), e.g. hexagon for `sides = 6`. */
const drawRegularPolygonPath = (ctx, cx, cy, radius, sides = 12) => {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const drawPolygonVertexSparkle = (ctx, cx, cy, radius, accent, compact, sides = 6) => {
  const rGlow = compact ? 7 : 10;
  for (let k = 0; k < sides; k += 1) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / sides;
    const sx = cx + Math.cos(a) * (radius + 2);
    const sy = cy + Math.sin(a) * (radius + 2);
    ctx.save();
    ctx.globalAlpha = 0.48;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rGlow);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, accent);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, rGlow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

const drawAvatarLabel = (ctx, text, x, y, size, options = {}) => {


  if (!text) return;
  const {
    placement = 'inside',
    background = 'rgba(10, 13, 27, 0.7)',
    stroke = 'rgba(255, 255, 255, 0.18)',
    color = '#ffffff',
    marginTop = 12,
  } = options;

  const labelPadding = 8;
  const labelHeight = Math.max(26, Math.floor(size * 0.22));
  const labelWidth = Math.min(size * 0.82, size - labelPadding * 2);
  const centeredLabelX = x + (size - labelWidth) / 2;
  const labelY = placement === 'below'
    ? y + size + marginTop
    : y + size - labelHeight - labelPadding;

  ctx.save();
  drawRoundedRect(ctx, centeredLabelX, labelY, labelWidth, labelHeight, 12);

  ctx.fillStyle = background;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  let fontSize = Math.floor(labelHeight * 0.5);
  ctx.font = `700 ${fontSize}px "Noto Sans SC", sans-serif`;
  while (ctx.measureText(text).width > labelWidth - 10 && fontSize > 10) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px "Noto Sans SC", sans-serif`;
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centeredLabelX + labelWidth / 2, labelY + labelHeight / 2 + 1);

  ctx.restore();
};



const drawCard = async ({ ctx, profile, title, subtitle, x, y, width }) => {
  const padding = 28;
  const contentWidth = width - padding * 2;
  const titleFont = 'bold 22px "Noto Sans SC", sans-serif';

  const nameFont = 'bold 28px "Noto Sans SC", sans-serif';
  const bodyFont = '18px "Noto Sans SC", sans-serif';
  const smallFont = '14px "Noto Sans SC", sans-serif';

  ctx.font = bodyFont;
  const description = profile.description || '';
  const note = profile.note || '';
  const tags = (profile.tags || []).slice(0, 4).join(' / ');
  const descriptionLines = getLines(ctx, description, contentWidth);
  const noteLines = getLines(ctx, note, contentWidth);
  const tagLines = getLines(ctx, `关键词：${tags}`, contentWidth);

  const lineHeight = 26;
  const baseHeight = 188;
  const cardHeight = baseHeight + (descriptionLines.length + noteLines.length + tagLines.length) * lineHeight;

  drawRoundedRect(ctx, x, y, width, cardHeight, 18);
  ctx.fillStyle = '#fffdfd';
  ctx.fill();
  ctx.strokeStyle = profile.accent || '#ff9fc8';
  ctx.lineWidth = 3;
  ctx.stroke();

  let cursorY = y + padding;

  ctx.font = titleFont;
  ctx.fillStyle = '#111111';
  ctx.fillText(title, x + padding, cursorY + 22);
  cursorY += 42;

  ctx.font = nameFont;
  ctx.fillStyle = '#111111';
  ctx.fillText(profile.name, x + padding, cursorY + 26);
  cursorY += 44;

  ctx.font = smallFont;
  ctx.fillStyle = '#111111';
  ctx.fillText(subtitle, x + padding, cursorY + 18);
  cursorY += 30;

  try {
    const avatar = await loadImage(profile.avatarImage);
    const avatarSize = 110;
    const avatarX = x + width - padding - avatarSize;
    const avatarY = y + padding;
    ctx.save();
    drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 18);
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    ctx.strokeStyle = profile.accent || '#ff9fc8';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 18);
    ctx.stroke();
  } catch (error) {
    // ignore avatar draw failures
  }

  ctx.font = bodyFont;
  ctx.fillStyle = '#111111';
  descriptionLines.forEach((line) => {
    ctx.fillText(line, x + padding, cursorY + lineHeight);
    cursorY += lineHeight;
  });

  ctx.fillStyle = '#2b0b1b';
  noteLines.forEach((line) => {
    ctx.fillText(line, x + padding, cursorY + lineHeight);
    cursorY += lineHeight;
  });

  ctx.font = smallFont;
  ctx.fillStyle = '#111111';
  tagLines.forEach((line) => {
    ctx.fillText(line, x + padding, cursorY + lineHeight);
    cursorY += lineHeight;
  });

  return y + cardHeight;
};

const normalizeGender = (gender = '') => {
  if (gender === 'male' || gender === 'female' || gender === 'nonbinary') return gender;
  return 'female';
};

const getShareTargetGender = (gender = '', variant = 'self') => {
  const normalizedGender = normalizeGender(gender);
  if (variant !== 'match') return normalizedGender;
  if (normalizedGender === 'male') return 'female';
  if (normalizedGender === 'female') return 'male';
  return normalizedGender;
};


const getShareCardTheme = (gender = '', variant = 'self') => {
  const normalizedGender = getShareTargetGender(gender, variant);

  const createElegantTheme = ({
    accent,
    accentSoft,
    bgStart,
    bgMid,
    bgEnd,
    bgStops,
    cardTop,
    cardBottom,
    portraitTop,
    portraitBottom,
    panelFill,
    headerFill,
    roleFill,
    primary,
    secondary,
    muted,
  }) => ({
    accent,
    accentGlow: accentSoft,
    bgStops: bgStops || [
      { offset: 0, color: bgStart },
      { offset: 0.54, color: bgMid },
      { offset: 1, color: bgEnd },
    ],
    cardStops: [
      { offset: 0, color: cardTop },
      { offset: 1, color: cardBottom },
    ],
    portraitStops: [
      { offset: 0, color: portraitTop },
      { offset: 1, color: portraitBottom },
    ],
    primaryText: primary,
    secondaryText: secondary,
    mutedText: muted,
    panelFill,
    panelStroke: `${accent}2e`,
    portraitStroke: `${accent}46`,
    portraitInnerFill: 'rgba(255, 255, 255, 0.58)',
    headerFill,
    headerStroke: `${accent}1f`,
    roleFill,
    roleStroke: `${accent}1f`,
    roleText: primary,
    badgeBackground: 'rgba(255, 255, 255, 0.92)',
    badgeStroke: `${accent}26`,
    qrFill: 'rgba(255, 255, 255, 0.94)',
    portraitTitleText: primary,
    frameHighlight: 'rgba(255, 255, 255, 0.26)',
    frameShade: 'rgba(255, 255, 255, 0)',
    cardShadow: 'rgba(43, 62, 92, 0.14)',
    pixelGrid: 'transparent',
    pixelGridStrong: 'transparent',
    starColor: 'transparent',
    starGlow: 'transparent',
    avatarFrameFill: 'rgba(255, 255, 255, 0.56)',
    roleLabel: variant === 'match' ? '匹配' : '自身',

  });

  const sakuraSelfTheme = createElegantTheme({
    accent: '#d3a2b8',
    accentSoft: '#ead0db',
    bgStart: '#efe4ea',
    bgMid: '#f8f2f5',
    bgEnd: '#eadde5',
    cardTop: '#fffdfd',
    cardBottom: '#f7eef2',
    portraitTop: '#fff5f8',
    portraitBottom: '#f0e3ea',
    panelFill: 'rgba(255, 255, 255, 0.82)',
    headerFill: 'rgba(255, 255, 255, 0.68)',
    roleFill: 'rgba(250, 240, 245, 0.92)',
    primary: '#352833',
    secondary: 'rgba(101, 78, 91, 0.78)',
    muted: 'rgba(133, 108, 120, 0.82)',
  });
  const sakuraMatchTheme = createElegantTheme({
    accent: '#c497b9',
    accentSoft: '#e5cfe0',
    bgStart: '#f4e4ef',
    bgMid: '#fbf5f8',
    bgEnd: '#efe0eb',
    cardTop: '#fffdfd',
    cardBottom: '#f7eef4',
    portraitTop: '#fff6fb',
    portraitBottom: '#efe0ef',
    panelFill: 'rgba(255, 255, 255, 0.84)',
    headerFill: 'rgba(255, 255, 255, 0.7)',
    roleFill: 'rgba(251, 242, 247, 0.92)',
    primary: '#3a2b35',
    secondary: 'rgba(110, 84, 98, 0.78)',
    muted: 'rgba(139, 112, 126, 0.82)',
  });
  const prismSelfTheme = createElegantTheme({
    accent: '#b783d9',
    accentSoft: '#ead7f8',
    bgStart: '#ffe1ec',
    bgMid: '#eef3ff',
    bgEnd: '#f7dcff',
    bgStops: [
      { offset: 0, color: '#ff9fb2' },
      { offset: 0.18, color: '#ffcf7d' },
      { offset: 0.34, color: '#fff59a' },
      { offset: 0.5, color: '#87e6b6' },
      { offset: 0.68, color: '#89c7ff' },
      { offset: 0.84, color: '#b8a3ff' },
      { offset: 1, color: '#f3a6ff' },
    ],
    cardTop: 'rgba(255, 253, 255, 0.96)',
    cardBottom: 'rgba(245, 240, 252, 0.92)',
    portraitTop: 'rgba(250, 245, 255, 0.96)',
    portraitBottom: 'rgba(233, 225, 246, 0.92)',
    panelFill: 'rgba(255, 255, 255, 0.82)',
    headerFill: 'rgba(255, 255, 255, 0.7)',
    roleFill: 'rgba(246, 240, 252, 0.92)',
    primary: '#2f2940',
    secondary: 'rgba(78, 69, 102, 0.78)',
    muted: 'rgba(111, 101, 136, 0.82)',
  });
  const prismMatchTheme = createElegantTheme({
    accent: '#a374e2',
    accentSoft: '#e2d4ff',
    bgStops: [
      { offset: 0, color: '#ff98b8' },
      { offset: 0.2, color: '#ffd49c' },
      { offset: 0.4, color: '#fef3a2' },
      { offset: 0.6, color: '#9ae9c6' },
      { offset: 0.78, color: '#90c4ff' },
      { offset: 0.92, color: '#c3a6ff' },
      { offset: 1, color: '#ffb0e6' },
    ],
    cardTop: 'rgba(255, 253, 255, 0.96)',
    cardBottom: 'rgba(241, 236, 255, 0.92)',
    portraitTop: 'rgba(250, 246, 255, 0.96)',
    portraitBottom: 'rgba(229, 221, 246, 0.92)',
    panelFill: 'rgba(255, 255, 255, 0.84)',
    headerFill: 'rgba(255, 255, 255, 0.72)',
    roleFill: 'rgba(244, 238, 252, 0.92)',
    primary: '#2a213d',
    secondary: 'rgba(74, 61, 102, 0.78)',
    muted: 'rgba(108, 96, 136, 0.82)',
  });
  const gildedSelfTheme = createElegantTheme({
    accent: '#c89d3f',
    accentSoft: '#f1d69a',
    bgStart: '#f6efe3',
    bgMid: '#fbf7ee',
    bgEnd: '#efe4d2',
    cardTop: 'rgba(255, 252, 246, 0.96)',
    cardBottom: 'rgba(246, 236, 218, 0.92)',
    portraitTop: 'rgba(255, 250, 242, 0.96)',
    portraitBottom: 'rgba(240, 230, 210, 0.92)',
    panelFill: 'rgba(255, 255, 255, 0.84)',
    headerFill: 'rgba(255, 255, 255, 0.7)',
    roleFill: 'rgba(251, 244, 230, 0.92)',
    primary: '#3b2e1a',
    secondary: 'rgba(92, 74, 48, 0.78)',
    muted: 'rgba(120, 97, 63, 0.82)',
  });
  const gildedMatchTheme = createElegantTheme({
    accent: '#b8892f',
    accentSoft: '#ecd29a',
    bgStart: '#f3ead8',
    bgMid: '#f7f1e4',
    bgEnd: '#e8dac0',
    cardTop: 'rgba(255, 250, 242, 0.96)',
    cardBottom: 'rgba(242, 230, 208, 0.92)',
    portraitTop: 'rgba(255, 247, 236, 0.96)',
    portraitBottom: 'rgba(236, 224, 200, 0.92)',
    panelFill: 'rgba(255, 255, 255, 0.84)',
    headerFill: 'rgba(255, 255, 255, 0.7)',
    roleFill: 'rgba(251, 242, 226, 0.92)',
    primary: '#3a2c16',
    secondary: 'rgba(90, 70, 40, 0.78)',
    muted: 'rgba(122, 98, 60, 0.82)',
  });

  if (normalizedGender === 'nonbinary') return variant === 'match' ? prismMatchTheme : prismSelfTheme;
  if (normalizedGender === 'male') return variant === 'match' ? gildedMatchTheme : gildedSelfTheme;
  return variant === 'match' ? sakuraMatchTheme : sakuraSelfTheme;
};

const getShareTextureConfig = (gender = '', variant = 'self', profile = {}) => {
  const normalizedGender = getShareTargetGender(gender, variant);
  const seedText = `${profile.id || profile.name || normalizedGender}-${variant}`;
  const seed = getSeed(seedText);


  if (normalizedGender === 'male') {
    if (variant === 'match') {
      return {
        type: 'sakura',
        options: {
          petal: 'rgba(236, 170, 194, 0.26)',
          core: 'rgba(214, 120, 154, 0.22)',
          count: 42,
          seed,
        },
      };
    }
    return {
      type: 'leaf',
      options: {
        color: 'rgba(203, 170, 92, 0.16)',
        vein: 'rgba(145, 110, 36, 0.12)',
        count: 34,
        seed,
      },
    };
  }


  if (normalizedGender === 'nonbinary') {
    return {
      type: 'rainbow',
      options: {
        colors: ['#ff8db1', '#ffc26b', '#fff08a', '#8fe3bd', '#85b8ff', '#b792ff'],
        alpha: variant === 'match' ? 0.16 : 0.12,
        stripeWidth: variant === 'match' ? 20 : 16,
        gap: variant === 'match' ? 8 : 12,
        angle: variant === 'match' ? -Math.PI / 8 : -Math.PI / 6,
        seed,
      },
    };
  }

  if (variant === 'match') {
    return {
      type: 'leaf',
      options: {
        color: 'rgba(197, 160, 92, 0.14)',
        vein: 'rgba(138, 102, 34, 0.12)',
        count: 28,
        seed,
      },
    };
  }
  return {
    type: 'sakura',
    options: {
      petal: 'rgba(243, 184, 206, 0.28)',
      core: 'rgba(226, 143, 177, 0.24)',
      count: 36,
      seed,
    },
  };

};


const getResultPanelPalette = (gender = '') => {

  const normalizedGender = normalizeGender(gender);
  const bluePanel = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(236,245,255,0.92)), #f8fbff',
    border: '#95cafd',
  };
  const pinkPanel = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(255,247,250,0.96)), #fffdfd',
    border: '#f4d8e2',
  };

  const rainbowPanel = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,241,255,0.92), rgba(255,245,249,0.92)), #fffdfd',
    border: '#c79fff',
  };

  if (normalizedGender === 'nonbinary') {
    return { self: rainbowPanel, match: rainbowPanel };
  }
  if (normalizedGender === 'male') {
    return { self: bluePanel, match: pinkPanel };
  }
  return { self: pinkPanel, match: bluePanel };
};

const generateShareImage = async (computed, options = {}) => {
  if (!computed) return null;
  await document.fonts?.ready;

  const {
    subtitleText = '属于你的角色简介',
    footerText = '长按保存「记忆卡」· 记录你的恋语瞬间（仅供娱乐）',
    themeVariant = 'self',
    compareProfiles = null,
    qrTargetUrl: qrTargetUrlOption,
  } = options;


  const selfProfile = computed.selfProfile;
  const qrTargetUrl = qrTargetUrlOption || getResultPageShareUrl(computed);
  const isComparePortrait = Boolean(compareProfiles?.left && compareProfiles?.right);
  const width = 900;
  const outerPadding = 34;
  const cardX = outerPadding;
  const cardY = outerPadding;
  const cardWidth = width - outerPadding * 2;
  const cardPadding = 34;
  const headerHeight = 58;
  const portraitHeight = isComparePortrait ? 520 : 606;
  const portraitWidth = cardWidth - cardPadding * 2;
  const avatarFrameSize = isComparePortrait ? 286 : 520;
  const avatarPadding = isComparePortrait ? 14 : 12;



  const nameFontSize = 78;
  const nameLineHeight = Math.floor(nameFontSize * 1.08);
  const subtitleFontSize = 22;
  const subtitleLineHeight = 34;
  const bodyFontSize = 21;
  const bodyLineHeight = 35;
  const chipHeight = 42;
  const chipGap = 12;
  const statHeight = 86;
  const panelGap = 18;
  const qrSize = 126;
  const footerBoxSize = qrSize + 20;
  const footerTextBottom = 126;
  const footerHeight = Math.max(footerBoxSize, footerTextBottom);
  const footerBottomPadding = 18;


  const contentWidth = portraitWidth - 48;
  const pixelFont = '600 12px "Noto Sans SC", sans-serif';
  const pixelFontSmall = '600 15px "Noto Sans SC", sans-serif';




  const selectedGender = normalizeGender(computed.gender);
  const cardTheme = getShareCardTheme(selectedGender, themeVariant);
  const accent = cardTheme.accent;
  const primaryText = cardTheme.primaryText;
  const secondaryText = cardTheme.secondaryText;
  const mutedText = cardTheme.mutedText;
  const adaptProfileCopy = (text = '') => (themeVariant === 'match' ? text.replace(/你/g, 'Ta') : text);
  const introText = adaptProfileCopy(selfProfile.description || '你的恋爱人格角色卡已解锁。');
  const skillText = adaptProfileCopy(
    [selfProfile.longDescription, selfProfile.note].filter(Boolean).join(' ') || '正在等待你在关系里继续解锁更多剧情。'
  );

  const cardIdText = `CPTI-${String(selfProfile.id || 'SELF').toUpperCase()}`;


  const tags = (selfProfile.tags || []).slice(0, 4);
  const easeRating = getEaseRating(selfProfile);
  const rarityRating = getRarityRating(selfProfile, themeVariant === 'match' ? 'need' : 'self');
  const rarityLabelCard = getRarityLabel(selfProfile);
  const easePanelHeight = 78;
  const rarityPanelHeight = 78;


  const canvas = document.createElement('canvas');

  const ctx = canvas.getContext('2d');
  const scale = window.devicePixelRatio || 1;

  const drawInfoPanel = ({ x, y, width: panelWidth, title, lines }) => {
    const panelHeight = 66 + lines.length * bodyLineHeight;
    drawPixelPanel(ctx, x, y, panelWidth, panelHeight, {
      fill: cardTheme.panelFill,
      stroke: cardTheme.panelStroke,
      border: 5,
      shadow: 'rgba(0, 0, 0, 0.18)',
      shadowOffsetX: 5,
      shadowOffsetY: 6,
    });

    ctx.fillStyle = mutedText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = pixelFontSmall;
    ctx.fillText(title, x + 22, y + 24);

    ctx.fillStyle = secondaryText;
    ctx.font = `${bodyFontSize}px "Noto Sans SC", sans-serif`;
    let lineY = y + 58;
    lines.forEach((line) => {
      ctx.fillText(line, x + 22, lineY);
      lineY += bodyLineHeight;
    });
    return panelHeight;
  };

  const drawAvatarPortrait = async ({ profile, frameX, frameY, frameSize, title, name, mode = 'self' }) => {
    if (title) {
      ctx.fillStyle = mutedText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = pixelFontSmall;
      ctx.fillText(title, frameX + frameSize / 2, frameY - 16);
    }

    const isMatchVariant = themeVariant === 'match';
    const nameOffsetY = isMatchVariant ? (isComparePortrait ? 44 : 48) : 34;

    const centerX = frameX + frameSize / 2;

    const centerY = frameY + frameSize / 2;
    const polyScale = isComparePortrait ? 0.9 : 1;
    const polyOuterR = frameSize * 0.46 * polyScale;

    ctx.save();
    ctx.globalAlpha = 0.55;
    drawRegularPolygonPath(ctx, centerX, centerY, polyOuterR + 18, SHARE_AVATAR_FRAME_SIDES);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill();
    ctx.restore();

    const polyRings = [
      {
        r: polyOuterR + 14,
        stroke: '#aef5ff',
        lw: isComparePortrait ? 6 : 8,
        glow: 'rgba(160, 245, 255, 0.95)',
        blur: isComparePortrait ? 18 : 24,
      },
      {
        r: polyOuterR + 8,
        stroke: '#ffe6a8',
        lw: isComparePortrait ? 5 : 7,
        glow: 'rgba(255, 230, 168, 0.9)',
        blur: isComparePortrait ? 16 : 20,
      },
      {
        r: polyOuterR + 3,
        stroke: '#e6c2ff',
        lw: isComparePortrait ? 5 : 6,
        glow: 'rgba(230, 194, 255, 0.82)',
        blur: isComparePortrait ? 14 : 18,
      },
      {
        r: polyOuterR,
        stroke: accent,
        lw: isComparePortrait ? 5 : 6,
        glow: cardTheme.accentGlow,
        blur: isComparePortrait ? 16 : 22,
      },
    ];
    polyRings.forEach((ring) => {
      ctx.save();
      ctx.shadowColor = ring.glow;
      ctx.shadowBlur = ring.blur;
      drawRegularPolygonPath(ctx, centerX, centerY, ring.r, SHARE_AVATAR_FRAME_SIDES);
      ctx.strokeStyle = ring.stroke;
      ctx.lineWidth = ring.lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    });

    const clipRadius = polyOuterR - 4;
    const avatarZoom = isComparePortrait ? 1.08 : 1.2;
    const drawSize = clipRadius * 2 * avatarZoom * 0.9;
    const drawX = centerX - drawSize / 2;
    const drawY = centerY - drawSize / 2 - (isComparePortrait ? 4 : 8);
    try {
      const avatar = await loadImage(profile.avatarImage);
      ctx.save();
      drawRegularPolygonPath(ctx, centerX, centerY, clipRadius, SHARE_AVATAR_FRAME_SIDES);
      ctx.clip();
      const faceGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, clipRadius * 1.15);
      faceGrad.addColorStop(0, 'rgba(255, 252, 255, 0.98)');
      faceGrad.addColorStop(1, 'rgba(255, 236, 246, 0.96)');
      ctx.fillStyle = faceGrad;
      drawRegularPolygonPath(ctx, centerX, centerY, clipRadius, SHARE_AVATAR_FRAME_SIDES);
      ctx.fill();
      ctx.drawImage(avatar, drawX, drawY, drawSize, drawSize);
      ctx.restore();

      ctx.save();
      drawRegularPolygonPath(ctx, centerX, centerY, clipRadius + 1.2, SHARE_AVATAR_FRAME_SIDES);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = isComparePortrait ? 1.5 : 2;
      ctx.stroke();
      ctx.restore();

      drawPolygonVertexSparkle(ctx, centerX, centerY, polyOuterR, accent, isComparePortrait, SHARE_AVATAR_FRAME_SIDES);
    } catch (error) {
      // ignore avatar draw failures
    }

    const rarityRating = getRarityRating(profile, mode);
    const rarityLabel = getRarityLabel(profile);


    const ssrFontSize = Math.round(frameSize * (isComparePortrait ? 0.16 : 0.2));

    const ssrX = frameX + (isComparePortrait ? 18 : 22);
    const ssrY = frameY + (isComparePortrait ? 28 : 34);
    ctx.save();
    const ssrGradient = ctx.createLinearGradient(ssrX, ssrY - ssrFontSize, ssrX + ssrFontSize * 2.2, ssrY + ssrFontSize);
    ssrGradient.addColorStop(0, '#caa9ff');
    ssrGradient.addColorStop(0.45, '#ffd27a');
    ssrGradient.addColorStop(1, '#7fe3ff');
    ctx.fillStyle = ssrGradient;
    ctx.font = `800 ${ssrFontSize}px "Noto Sans SC", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.fillText(rarityLabel, ssrX, ssrY);
    ctx.restore();



    if (name) {
      ctx.fillStyle = primaryText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = isComparePortrait ? '700 24px "Noto Sans SC", sans-serif' : '700 28px "Noto Sans SC", sans-serif';
      ctx.fillText(name, frameX + frameSize / 2, frameY + frameSize + nameOffsetY);
    }


    const starOuter = isComparePortrait ? 20 : 22;

    const starInner = starOuter * 0.58;
    const starGap = isComparePortrait ? 14 : 16;
    const starTotalWidth = 5 * starOuter * 2 + 4 * starGap;
    const starStartX = frameX + (frameSize - starTotalWidth) / 2 + starOuter;
    const starY = isMatchVariant
      ? frameY + frameSize - (isComparePortrait ? 14 : 16) - starOuter * 2
      : frameY + frameSize - (isComparePortrait ? 12 : 14) - starOuter * 2;


    const activeStar = '#ffd86b';

    const inactiveStar = '#3a3f4f';



    for (let i = 0; i < 5; i += 1) {
      const isActive = i < rarityRating;
      drawStarStyled(ctx, starStartX + i * (starOuter * 2 + starGap), starY, starOuter, starInner, {
        fill: isActive ? activeStar : inactiveStar,
        stroke: isActive ? '#a6731b' : '#6a4a1a',

        strokeWidth: isComparePortrait ? 2.5 : 3,
        glow: isActive ? 'rgba(255, 216, 107, 0.92)' : 'rgba(255, 255, 255, 0.25)',

        glowBlur: isComparePortrait ? 16 : 20,
      });

    }


  };



  ctx.font = `800 ${nameFontSize}px "Noto Sans SC", sans-serif`;
  const nameLines = getLines(ctx, selfProfile.name, portraitWidth - 72);
  ctx.font = `${subtitleFontSize}px "Noto Sans SC", sans-serif`;
  const subtitleLines = getLines(ctx, subtitleText, portraitWidth - 88);
  const introLines = getLines(ctx, introText, contentWidth);
  const skillLinesRaw = getLines(ctx, skillText, contentWidth);
  const skillLines = skillLinesRaw.slice(0, 5);

  ctx.font = '600 16px "Noto Sans SC", sans-serif';
  const typeLineFull = `${selfProfile.abbr || '—'}｜${rarityLabelCard} · 恋语角色`;
  const typeLines = getLines(ctx, typeLineFull, portraitWidth - 36);
  const tcgTypeHeight = typeLines.length * 22 + 10;
  const tcgBattleHeight = 90;
  const flavorPreview = (selfProfile.note || '').trim().slice(0, 80);
  ctx.font = `${bodyFontSize}px "Noto Sans SC", sans-serif`;
  const flavorLines = flavorPreview
    ? getLines(ctx, `心语：${flavorPreview}`, contentWidth - 4).slice(0, 2)
    : [];
  const flavorBlockHeight = flavorLines.length ? 16 + flavorLines.length * 22 : 0;

  ctx.font = '700 18px "Noto Sans SC", sans-serif';
  const chipRows = [];
  let currentRow = [];
  let currentRowWidth = 0;
  tags.forEach((tag) => {
    const chipWidth = Math.ceil(ctx.measureText(tag).width) + 34;
    const nextWidth = currentRow.length ? currentRowWidth + chipGap + chipWidth : chipWidth;
    if (nextWidth > portraitWidth && currentRow.length) {
      chipRows.push(currentRow);
      currentRow = [{ text: tag, width: chipWidth }];
      currentRowWidth = chipWidth;
    } else {
      currentRow.push({ text: tag, width: chipWidth });
      currentRowWidth = nextWidth;
    }
  });
  if (currentRow.length) chipRows.push(currentRow);

  const nameHeight = nameLines.length * nameLineHeight;
  const subtitleHeight = subtitleLines.length * subtitleLineHeight;
  const tagBlockHeight = chipRows.length ? chipRows.length * chipHeight + (chipRows.length - 1) * chipGap : 0;
  const tagSectionHeight = chipRows.length ? 34 + tagBlockHeight : 0;
  const introPanelHeight = 66 + introLines.length * bodyLineHeight;
  const skillPanelHeight = 66 + skillLines.length * bodyLineHeight;
  const cardHeight =
    cardPadding +
    headerHeight +
    portraitHeight +
    24 +
    nameHeight +
    10 +
    subtitleHeight +
    tcgTypeHeight +
    tcgBattleHeight +
    flavorBlockHeight +
    16 +
    statHeight +
    18 +
    easePanelHeight +
    16 +
    rarityPanelHeight +
    16 +
    tagSectionHeight +
    panelGap +
    introPanelHeight +
    panelGap +
    skillPanelHeight +
    18 +
    footerHeight +
    footerBottomPadding;



  const height = cardHeight + outerPadding * 2;

  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  cardTheme.bgStops.forEach(({ offset, color }) => bgGradient.addColorStop(offset, color));
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);

  cardTheme.cardStops.forEach(({ offset, color }) => cardGradient.addColorStop(offset, color));
  drawPixelPanel(ctx, cardX, cardY, cardWidth, cardHeight, {
    fill: cardGradient,
    stroke: accent,
    highlight: cardTheme.frameHighlight,
    shade: cardTheme.frameShade,
    border: 8,
    inset: 3,
    shadow: cardTheme.cardShadow,
    shadowOffsetX: 10,
    shadowOffsetY: 12,
    showHighlight: true,
    showShade: true,
    showCorners: true,
  });

  const textureConfig = getShareTextureConfig(selectedGender, themeVariant, selfProfile);
  if (textureConfig?.type) {
    const cardRadius = Math.max(12, Math.min(24, cardWidth * 0.08, cardHeight * 0.18));
    ctx.save();
    drawRoundedRect(ctx, cardX + 6, cardY + 6, cardWidth - 12, cardHeight - 12, cardRadius);
    ctx.clip();
    const textureX = cardX + 12;
    const textureY = cardY + 12;
    const textureWidth = cardWidth - 24;
    const textureHeight = cardHeight - 24;
    if (textureConfig.type === 'leaf') {
      drawLeafTexture(ctx, textureX, textureY, textureWidth, textureHeight, textureConfig.options);
    }
    if (textureConfig.type === 'sakura') {
      drawSakuraTexture(ctx, textureX, textureY, textureWidth, textureHeight, textureConfig.options);
    }
    if (textureConfig.type === 'rainbow') {
      drawRainbowTexture(ctx, textureX, textureY, textureWidth, textureHeight, textureConfig.options);
    }
    ctx.restore();
  }

  const cardInsetRadius = Math.max(14, Math.min(26, cardWidth * 0.06));
  ctx.save();
  drawRoundedRect(ctx, cardX + 8, cardY + 8, cardWidth - 16, cardHeight - 16, cardInsetRadius);
  const insetGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
  insetGrad.addColorStop(0, 'rgba(255, 192, 210, 0.78)');
  insetGrad.addColorStop(0.45, 'rgba(255, 228, 200, 0.7)');
  insetGrad.addColorStop(1, 'rgba(255, 182, 200, 0.75)');
  ctx.strokeStyle = insetGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  drawOtomeBokeh(
    ctx,
    cardX + 10,
    cardY + 10,
    cardWidth - 20,
    cardHeight - 20,
    getSeed(`${selfProfile.id}-${themeVariant}-bokeh`),
    accent,
  );
  let cursorY = cardY + cardPadding;

  const headerY = cursorY;
  drawPixelBadge(ctx, {
    x: cardX + cardPadding,
    y: headerY,
    text: '限定记忆 · CPTI',

    fill: cardTheme.headerFill,
    stroke: cardTheme.headerStroke,
    textColor: primaryText,
    shadow: 'rgba(0, 0, 0, 0.16)',
    font: pixelFont,
    padX: 18,
    height: 36,
  });
  drawPixelBadge(ctx, {
    x: cardX + cardWidth - cardPadding,
    y: headerY,
    text: `♥ ${rarityLabelCard} 稀有`,
    fill: cardTheme.roleFill,
    stroke: cardTheme.roleStroke,
    textColor: cardTheme.roleText,
    shadow: 'rgba(0, 0, 0, 0.16)',
    font: pixelFont,
    padX: 18,
    height: 36,
    align: 'right',
  });




  cursorY += headerHeight;

  const portraitX = cardX + cardPadding;
  const portraitY = cursorY;
  const portraitGradient = ctx.createLinearGradient(portraitX, portraitY, portraitX, portraitY + portraitHeight);
  cardTheme.portraitStops.forEach(({ offset, color }) => portraitGradient.addColorStop(offset, color));
  drawPixelPanel(ctx, portraitX, portraitY, portraitWidth, portraitHeight, {
    fill: portraitGradient,
    stroke: cardTheme.portraitStroke,
    highlight: cardTheme.frameHighlight,
    shade: cardTheme.frameShade,
    border: 8,
    inset: 3,
    shadow: 'rgba(0, 0, 0, 0.14)',
    shadowOffsetX: 0,
    shadowOffsetY: 10,
    showHighlight: true,
    showShade: true,
    showCorners: true,
  });

  const innerPortraitX = portraitX + 18;
  const innerPortraitY = portraitY + 18;
  const innerPortraitWidth = portraitWidth - 36;
  const innerPortraitHeight = portraitHeight - 36;
  drawPixelPanel(ctx, innerPortraitX, innerPortraitY, innerPortraitWidth, innerPortraitHeight, {
    fill: cardTheme.portraitInnerFill,
    stroke: 'rgba(255, 255, 255, 0.06)',
    border: 4,
    shadow: '',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  });

  if (isComparePortrait) {
    const compareInset = 54;
    const compareFrameY = innerPortraitY + 96;
    const leftFrameX = innerPortraitX + compareInset;
    const rightFrameX = innerPortraitX + innerPortraitWidth - compareInset - avatarFrameSize;

    await drawAvatarPortrait({
      profile: compareProfiles.left,
      frameX: leftFrameX,
      frameY: compareFrameY,
      frameSize: avatarFrameSize,
      title: '卡面立绘',
      name: compareProfiles.left.name,
      mode: 'self',
    });
    await drawAvatarPortrait({
      profile: compareProfiles.right,
      frameX: rightFrameX,
      frameY: compareFrameY,
      frameSize: avatarFrameSize,
      title: '羁绊立绘',
      name: compareProfiles.right.name,
      mode: 'need',
    });


    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px "Noto Sans SC", sans-serif';
    ctx.fillText('VS', innerPortraitX + innerPortraitWidth / 2, compareFrameY + avatarFrameSize / 2 + 4);
  } else {

    const avatarFrameX = innerPortraitX + (innerPortraitWidth - avatarFrameSize) / 2;
    const avatarFrameY = innerPortraitY + (innerPortraitHeight - avatarFrameSize) / 2;
    await drawAvatarPortrait({
      profile: selfProfile,
      frameX: avatarFrameX,
      frameY: avatarFrameY,
      frameSize: avatarFrameSize,
      mode: 'self',
    });

  }



  cursorY = portraitY + portraitHeight + 24;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${nameFontSize}px "Noto Sans SC", sans-serif`;
  ctx.shadowColor = 'rgba(4, 8, 18, 0.3)';
  ctx.shadowBlur = 12;
  nameLines.forEach((line) => {
    ctx.fillStyle = primaryText;
    ctx.fillText(line, cardX + cardWidth / 2, cursorY + nameFontSize);
    cursorY += nameLineHeight;
  });
  ctx.shadowBlur = 0;

  ctx.fillStyle = secondaryText;
  ctx.font = `${subtitleFontSize}px "Noto Sans SC", sans-serif`;
  subtitleLines.forEach((line) => {
    ctx.fillText(line, cardX + cardWidth / 2, cursorY + subtitleFontSize + 8);
    cursorY += subtitleLineHeight;
  });

  cursorY += 8;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 16px "Noto Sans SC", sans-serif';
  ctx.fillStyle = mutedText;
  typeLines.forEach((line) => {
    ctx.fillText(line, cardX + cardWidth / 2, cursorY + 16);
    cursorY += 22;
  });
  cursorY += 6;

  const atk = 820 + rarityRating * 210 + easeRating * 45;
  const def = 700 + (6 - easeRating) * 120;
  const bond = Math.min(9999, Math.round((Number(computed.selfConfidence) || 63) * 38 + rarityRating * 95));
  const colGap = 10;
  const colW = (portraitWidth - colGap * 2) / 3;
  const rowX0 = cardX + cardPadding;
  drawTcgStatPlate(ctx, rowX0, cursorY, colW, tcgBattleHeight, {
    label: '好感度',
    value: atk,
    sub: '恋爱相性',
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    primary: primaryText,
    muted: mutedText,
    accent,
  });
  drawTcgStatPlate(ctx, rowX0 + colW + colGap, cursorY, colW, tcgBattleHeight, {
    label: '守护力',
    value: def,
    sub: '情绪护盾',
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    primary: primaryText,
    muted: mutedText,
    accent,
  });
  drawTcgStatPlate(ctx, rowX0 + (colW + colGap) * 2, cursorY, colW, tcgBattleHeight, {
    label: '羁绊值',
    value: bond,
    sub: '心动同步',
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    primary: primaryText,
    muted: mutedText,
    accent,
  });
  cursorY += tcgBattleHeight + 10;

  if (flavorLines.length) {
    ctx.textAlign = 'left';
    ctx.font = `italic 15px "Noto Sans SC", sans-serif`;
    ctx.fillStyle = secondaryText;
    let fy = cursorY + 18;
    flavorLines.forEach((line) => {
      ctx.fillText(line, cardX + cardPadding + 8, fy);
      fy += 22;
    });
    cursorY += flavorBlockHeight;
  }

  cursorY += 12;
  const statGap = 16;
  const statWidth = (portraitWidth - statGap) / 2;
  const statY = cursorY;
  const statX1 = cardX + cardPadding;
  const statX2 = statX1 + statWidth + statGap;

  [
    { x: statX1, label: '收藏编号', value: cardIdText },
    { x: statX2, label: '心动契合', value: `${computed.selfConfidence}%` },
  ].forEach(({ x, label, value }) => {

    drawPixelPanel(ctx, x, statY, statWidth, statHeight, {
      fill: cardTheme.panelFill,
      stroke: cardTheme.panelStroke,
      border: 5,
      shadow: 'rgba(0, 0, 0, 0.16)',
      shadowOffsetX: 4,
      shadowOffsetY: 6,
    });

    ctx.fillStyle = mutedText;
    ctx.font = pixelFontSmall;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 18, statY + 24);
    ctx.fillStyle = primaryText;
    ctx.font = '700 24px "Noto Sans SC", sans-serif';
    ctx.fillText(value, x + 18, statY + 58);
  });

  cursorY += statHeight + 18;

  const infoGap = 16;
  const infoPanelWidth = (portraitWidth - infoGap) / 2;
  const easePanelX = cardX + cardPadding;
  const rarityPanelX = easePanelX + infoPanelWidth + infoGap;

  drawPixelPanel(ctx, easePanelX, cursorY, infoPanelWidth, easePanelHeight, {
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    border: 5,
    shadow: 'rgba(0, 0, 0, 0.14)',
    shadowOffsetX: 4,
    shadowOffsetY: 6,
  });
  ctx.fillStyle = mutedText;
  ctx.font = pixelFontSmall;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('易陷程度', easePanelX + 18, cursorY + 24);

  const starOuter = 12.6;
  const starInner = 6.3;
  const starGap = 14.4;
  const starTotalWidth = 5 * starOuter * 2 + 4 * starGap;
  const starStartX = easePanelX + (infoPanelWidth - starTotalWidth) / 2 + starOuter;
  const starY = cursorY + 52;
  const activeStar = accent;
  const inactiveStar = 'rgba(140, 150, 165, 0.35)';
  for (let i = 0; i < 5; i += 1) {
    const color = i < easeRating ? activeStar : inactiveStar;
    drawStar(ctx, starStartX + i * (starOuter * 2 + starGap), starY, starOuter, starInner, color);
  }

  drawPixelPanel(ctx, rarityPanelX, cursorY, infoPanelWidth, rarityPanelHeight, {
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    border: 5,
    shadow: 'rgba(0, 0, 0, 0.14)',
    shadowOffsetX: 4,
    shadowOffsetY: 6,
  });
  ctx.fillStyle = mutedText;
  ctx.font = pixelFontSmall;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('恋语稀有度', rarityPanelX + 18, cursorY + 24);

  const rarityStarOuter = 12.6;
  const rarityStarInner = 6.3;
  const rarityStarGap = 14.4;
  const rarityStarTotalWidth = 5 * rarityStarOuter * 2 + 4 * rarityStarGap;
  const rarityStarStartX = rarityPanelX + (infoPanelWidth - rarityStarTotalWidth) / 2 + rarityStarOuter;
  const rarityStarY = cursorY + 52;
  const rarityActiveStar = accent;
  const rarityInactiveStar = 'rgba(140, 150, 165, 0.35)';
  for (let i = 0; i < 5; i += 1) {
    const color = i < rarityRating ? rarityActiveStar : rarityInactiveStar;
    drawStar(ctx, rarityStarStartX + i * (rarityStarOuter * 2 + rarityStarGap), rarityStarY, rarityStarOuter, rarityStarInner, color);
  }

  cursorY += Math.max(easePanelHeight, rarityPanelHeight) + 16;


  if (chipRows.length) {
    ctx.fillStyle = mutedText;
    ctx.font = pixelFontSmall;
    ctx.textAlign = 'left';
    ctx.fillText('关键词', cardX + cardPadding, cursorY + 14);
    cursorY += 32;



    chipRows.forEach((row) => {
      let chipX = cardX + cardPadding;
      row.forEach(({ text, width: chipWidth }) => {
        drawPixelPanel(ctx, chipX, cursorY, chipWidth, chipHeight, {
          fill: cardTheme.panelFill,
          stroke: accent,
          border: 4,
          shadow: '',
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        });

        ctx.fillStyle = primaryText;
        ctx.font = '700 18px "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, chipX + chipWidth / 2, cursorY + chipHeight / 2 + 1);
        chipX += chipWidth + chipGap;
      });
      cursorY += chipHeight + chipGap;
    });

    cursorY -= chipGap;
    cursorY += panelGap;
  }

  const introHeightDrawn = drawInfoPanel({
    x: cardX + cardPadding,
    y: cursorY,
    width: portraitWidth,
    title: '角色简介',
    lines: introLines,
  });

  cursorY += introHeightDrawn + panelGap;

  const skillHeightDrawn = drawInfoPanel({
    x: cardX + cardPadding,
    y: cursorY,
    width: portraitWidth,
    title: '专属技能',
    lines: skillLines,
  });

  cursorY += skillHeightDrawn + 18;

  const footerY = cursorY;
  const qrBoxX = cardX + cardWidth - cardPadding - footerBoxSize;
  drawPixelPanel(ctx, qrBoxX, footerY, footerBoxSize, footerBoxSize, {

    fill: cardTheme.qrFill,
    stroke: cardTheme.panelStroke,
    border: 5,
    shadow: 'rgba(0, 0, 0, 0.14)',
    shadowOffsetX: 0,
    shadowOffsetY: 8,
  });

  try {
    const qrImage = await loadRemoteImage(`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrTargetUrl)}`);
    ctx.drawImage(qrImage, qrBoxX + 10, footerY + 10, qrSize, qrSize);
  } catch (error) {
    // ignore qr draw failures
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = mutedText;
  ctx.font = pixelFontSmall;
  ctx.fillText('恋语实验室 · 记忆卡', cardX + cardPadding, footerY + 20);
  ctx.fillStyle = primaryText;
  ctx.font = '700 24px "Noto Sans SC", sans-serif';
  ctx.fillText('CPTI 恋爱人格实验室', cardX + cardPadding, footerY + 52);
  ctx.fillStyle = secondaryText;
  ctx.font = '18px "Noto Sans SC", sans-serif';
  ctx.fillText(footerText, cardX + cardPadding, footerY + 86);
  ctx.fillStyle = mutedText;

  ctx.font = '16px "Noto Sans SC", sans-serif';
  ctx.fillText('cpti.cc © 兰州小红鸡 · 限定卡面仅供分享', cardX + cardPadding, footerY + 126);

  drawTcgCornerBrackets(ctx, cardX + 1, cardY + 1, cardWidth - 2, cardHeight - 2);
  drawOtomeWatermarkHearts(ctx, cardX, cardY, cardWidth, cardHeight, accent);

  return canvas.toDataURL('image/png');


};

const generateMatchShareImage = async (computed) => {
  if (!computed) return null;
  const matchedComputed = {
    ...computed,
    selfProfile: computed.needProfile,
    selfConfidence: computed.needConfidence,
  };

  return generateShareImage(matchedComputed, {
    subtitleText: '与他的角色简介',
    footerText: '长按保存「羁绊记忆卡」· 适合与 Ta 一起收藏（仅供娱乐）',
    themeVariant: 'match',
    qrTargetUrl: getResultPageShareUrl(computed),
    compareProfiles: {

      left: computed.selfProfile,
      right: computed.needProfile,
    },
  });


};



const getShareBundleKey = (computed) => JSON.stringify({
  gender: computed?.gender || '',
  selfId: computed?.selfProfile?.id || '',
  needId: computed?.needProfile?.id || '',
  selfConfidence: computed?.selfConfidence || 0,
  needConfidence: computed?.needConfidence || 0,
});

const buildShareSlides = (computed, selfDataUrl, matchDataUrl) => {
  const slides = [];
  if (selfDataUrl) {
    slides.push({
      id: 'self',
      title: '我的恋爱人格画像',
      subtitle: computed?.selfProfile?.name || '你的恋爱人格',
      alt: `${computed?.selfProfile?.name || '你的恋爱人格'} 分享图`,
      dataUrl: selfDataUrl,
    });
  }
  if (matchDataUrl) {
    slides.push({
      id: 'match',
      title: '和我匹配的人格画像',
      subtitle: computed?.needProfile?.name || '匹配人格',
      alt: `${computed?.needProfile?.name || '匹配人格'} 分享图`,
      dataUrl: matchDataUrl,
    });
  }
  return slides;
};

const ensureShareAssetState = (computed) => {
  const bundleKey = getShareBundleKey(computed);

  if (!shareAssetCache || shareAssetCache.key !== bundleKey) {
    shareAssetCache = {
      key: bundleKey,
      self: null,
      match: null,
    };
  }

  if (!shareAssetPromises || shareAssetPromises.key !== bundleKey) {
    shareAssetPromises = {
      key: bundleKey,
      self: null,
      match: null,
    };
  }

  return {
    bundleKey,
    cache: shareAssetCache,
    promises: shareAssetPromises,
  };
};

const getCachedShareSlides = (computed, options = {}) => {
  if (!computed) return [];

  const {
    includeSelf = true,
    includeMatch = true,
  } = options;

  const { cache } = ensureShareAssetState(computed);
  return buildShareSlides(
    computed,
    includeSelf ? cache.self : null,
    includeMatch ? cache.match : null,
  );
};

const getShareSlideIndex = (slides = [], slideId = 'self') => {
  if (!Array.isArray(slides) || !slides.length) return 0;
  const matchedIndex = slides.findIndex((slide) => slide.id === slideId);
  return Math.max(0, matchedIndex);
};

const syncShareModalWithCachedSlides = (computed, preferredSlideId = null) => {
  const slides = getCachedShareSlides(computed, {
    includeSelf: true,
    includeMatch: true,
  });
  if (!slides.length) return false;

  const activeSlideId = preferredSlideId || shareModalSlides[activeShareSlideIndex]?.id || 'self';
  openShareModal(slides, getShareSlideIndex(slides, activeSlideId));
  return true;
};

const ensureShareAsset = async (computed, variant = 'self') => {
  if (!computed) return null;

  const { bundleKey, cache, promises } = ensureShareAssetState(computed);
  if (cache[variant]) return cache[variant];
  if (promises[variant]) return promises[variant];

  const generator = variant === 'match' ? generateMatchShareImage : generateShareImage;
  const promise = generator(computed)
    .then((dataUrl) => {
      if (shareAssetCache?.key === bundleKey) {
        shareAssetCache[variant] = dataUrl || null;
      }
      return dataUrl || null;
    })
    .catch((error) => {
      console.error(`Failed to generate ${variant} share image:`, error);
      return null;
    })
    .finally(() => {
      if (shareAssetPromises?.key === bundleKey) {
        shareAssetPromises[variant] = null;
      }
    });

  promises[variant] = promise;
  return promise;
};

const appendMatchShareSlide = async (computed, preferredSlideId = null) => {
  if (!computed) return null;

  const bundleKey = getShareBundleKey(computed);
  const matchDataUrl = await ensureShareAsset(computed, 'match');
  if (!matchDataUrl) return null;

  if (shareAssetCache?.key !== bundleKey) {
    return matchDataUrl;
  }

  if (shareModal?.classList.contains('hidden')) {
    return matchDataUrl;
  }

  syncShareModalWithCachedSlides(computed, preferredSlideId);
  return matchDataUrl;
};

const clearShareCarouselHoldTimer = () => {
  if (shareCarouselHoldTimer) {
    window.clearTimeout(shareCarouselHoldTimer);
    shareCarouselHoldTimer = null;
  }
};

const endShareGalleryHold = () => {
  clearShareCarouselHoldTimer();
  shareCarouselHoldActive = false;
  shareCarouselPaused = false;
};

const stopShareCarousel = () => {
  if (shareCarouselTimer) {
    window.clearInterval(shareCarouselTimer);
    shareCarouselTimer = null;
  }
};

const scheduleShareCarousel = () => {
  stopShareCarousel();
  if (!shareModal || shareModal.classList.contains('hidden')) return;
  if (shareModalSlides.length < 2) return;
  shareCarouselTimer = window.setInterval(() => {
    if (shareCarouselPaused) return;
    const n = shareModalSlides.length;
    if (n < 2) return;
    setActiveShareSlide((activeShareSlideIndex + 1) % n);
  }, SHARE_CAROUSEL_INTERVAL_MS);
};

const bindShareGalleryCarouselPause = () => {
  if (!shareGallery || shareGallery.dataset.shareHoldBound) return;
  shareGallery.dataset.shareHoldBound = '1';

  shareGallery.addEventListener('pointerdown', (event) => {
    if (shareModal?.classList.contains('hidden')) return;
    if (shareModalSlides.length < 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    shareCarouselHoldActive = true;
    shareCarouselHoldStartX = event.clientX;
    shareCarouselHoldStartY = event.clientY;
    clearShareCarouselHoldTimer();
    shareCarouselHoldTimer = window.setTimeout(() => {
      if (shareCarouselHoldActive) shareCarouselPaused = true;
    }, SHARE_CAROUSEL_PAUSE_HOLD_MS);
  });

  shareGallery.addEventListener('pointermove', (event) => {
    if (!shareCarouselHoldTimer) return;
    const dx = event.clientX - shareCarouselHoldStartX;
    const dy = event.clientY - shareCarouselHoldStartY;
    if (dx * dx + dy * dy > 144) {
      clearShareCarouselHoldTimer();
      shareCarouselHoldActive = false;
    }
  }, { passive: true });

  window.addEventListener('pointerup', endShareGalleryHold, true);
  window.addEventListener('pointercancel', endShareGalleryHold, true);
};

const renderShareIndicators = () => {
  if (!shareIndicators) return;

  shareIndicators.innerHTML = shareModalSlides.map((slide, index) => `
    <button
      class='share-indicator ${index === activeShareSlideIndex ? 'is-active' : ''}'
      type='button'
      data-share-index='${index}'
      aria-label='查看第 ${index + 1} 张：${slide.title}'
      aria-pressed='${index === activeShareSlideIndex ? 'true' : 'false'}'
    ></button>
  `).join('');
};

const updateShareNavState = () => {

  const hasMultipleSlides = shareModalSlides.length > 1;
  sharePrevButton?.classList.toggle('hidden', !hasMultipleSlides);
  shareNextButton?.classList.toggle('hidden', !hasMultipleSlides);

  if (sharePrevButton) {
    sharePrevButton.disabled = !hasMultipleSlides;
  }
  if (shareNextButton) {
    shareNextButton.disabled = !hasMultipleSlides;
  }
};

const updateShareGallery = () => {
  if (!shareTrack) return;

  shareTrack.style.transform = `translateX(-${activeShareSlideIndex * 100}%)`;
  renderShareIndicators();
  updateShareNavState();
};

const setActiveShareSlide = (index = 0) => {
  if (!shareModalSlides.length) return;
  activeShareSlideIndex = Math.max(0, Math.min(index, shareModalSlides.length - 1));
  updateShareGallery();
  scheduleShareCarousel();
};

const renderShareGallery = (slides) => {
  shareModalSlides = Array.isArray(slides) ? slides : [];
  if (!shareTrack) return;

  shareTrack.innerHTML = shareModalSlides.map((slide) => `
    <figure class='share-gallery-slide' data-share-slide='${slide.id}'>
      <div class='share-image-shell'>
        <img class='share-gallery-image' src='${slide.dataUrl}' alt='${slide.alt}' draggable='false' />
      </div>
    </figure>
  `).join('');


  if (!shareModalSlides.length && shareIndicators) {
    shareIndicators.innerHTML = '';
  }

  setActiveShareSlide(activeShareSlideIndex);
};

const openShareModal = (slides, startIndex = 0) => {
  if (!shareModal || !shareTrack || !slides?.length) return;

  shareCarouselPaused = false;
  shareCarouselHoldActive = false;
  clearShareCarouselHoldTimer();
  activeShareSlideIndex = Math.max(0, Math.min(startIndex, slides.length - 1));
  renderShareGallery(slides);
  shareModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

const closeShareModal = () => {
  shareTouchStartX = null;
  stopShareCarousel();
  shareCarouselPaused = false;
  shareCarouselHoldActive = false;
  clearShareCarouselHoldTimer();
  shareModal?.classList.add('hidden');
  document.body.style.overflow = '';
};

const showPrevShareSlide = () => {
  const n = shareModalSlides.length;
  if (n < 2) return;
  setActiveShareSlide((activeShareSlideIndex - 1 + n) % n);
};

const showNextShareSlide = () => {
  const n = shareModalSlides.length;
  if (n < 2) return;
  setActiveShareSlide((activeShareSlideIndex + 1) % n);
};

const openSelfSharePreview = async (computed) => {
  const selfDataUrl = await ensureShareAsset(computed, 'self');
  if (!selfDataUrl) {
    throw new Error('Self share image unavailable');
  }

  const openedFromCache = syncShareModalWithCachedSlides(computed, 'self');
  if (!openedFromCache) {
    openShareModal(buildShareSlides(computed, selfDataUrl, null), 0);
  }

  const { cache } = ensureShareAssetState(computed);
  if (!cache.match) {
    void appendMatchShareSlide(computed);
  }
};

const openMatchSharePreview = async (computed) => {
  const selfDataUrl = await ensureShareAsset(computed, 'self');
  if (!selfDataUrl) {
    throw new Error('Self share image unavailable');
  }

  const cachedSlides = getCachedShareSlides(computed, {
    includeSelf: true,
    includeMatch: true,
  });
  if (cachedSlides.length > 1) {
    openShareModal(cachedSlides, getShareSlideIndex(cachedSlides, 'match'));
    return;
  }

  openShareModal(buildShareSlides(computed, selfDataUrl, null), 0);
  const matchDataUrl = await appendMatchShareSlide(computed, 'match');
  if (!matchDataUrl) {
    throw new Error('Match share image unavailable');
  }
};

const autoOpenShare = async (computed) => {
  if (autoShareOpened || !shareModal || computed?.fromLinkSnapshot) return;
  autoShareOpened = true;
  try {
    await openSelfSharePreview(computed);
  } catch (error) {
    console.error('Failed to generate auto self share preview:', error);
  }
};





const catalogBadges = (profile, selfId, needId) => {

  const badges = [];
  if (profile.id === selfId) badges.push('<span class="catalog-flag self">你自己</span>');
  if (profile.id === needId) badges.push('<span class="catalog-flag need">适合你</span>');
  return badges.join('');
};

const catalogHtml = (profile, selfId, needId) => {
  const isSelf = profile.id === selfId;
  const isNeed = profile.id === needId;
  const cardClass = isSelf && isNeed ? 'catalog-card is-double-active' : isSelf || isNeed ? 'catalog-card is-active' : 'catalog-card';

  const rarityLabel = getProfileRarityLabel(profile.id);
  return `
    <a
      class='${cardClass} profile-card-link'
      href='${profileDetailHref(profile.id, 'result')}'
      aria-label='查看 ${profile.name} 人格详情'
      style='--card-accent:${profile.accent}; --card-soft:${profile.soft};'
    >
      <span class='catalog-card-foil' aria-hidden='true'></span>
      <div class='catalog-card-top'>
        ${avatarHtml(profile, 'small')}
      </div>
      <div class='catalog-card-copy'>
        <div class='catalog-name-row'>
          <h3>${profile.name}</h3>
          <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
        </div>
        <div class='catalog-flag-row'>
          ${catalogBadges(profile, selfId, needId)}
        </div>
      </div>
      <p>${profile.description}</p>
      <div class='tag-row compact'>
        ${profile.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('')}
      </div>
      <div class='catalog-card-footer'>
        <span class='profile-link-hint'>查看人格详情 →</span>
      </div>
    </a>
  `;
};


const renderComputedView = (computed) => {
  if (!computed?.selfProfile || !computed?.needProfile) return;

  resultEmpty?.classList.add('hidden');
  resultView?.classList.remove('hidden');

  formulaTitle.textContent = computed.formulaTitle;
  renderResultHeroCast(computed.selfProfile, computed.needProfile);
  const selfRarityLabel = getProfileRarityLabel(computed.selfProfile?.id);
  const needRarityLabel = getProfileRarityLabel(computed.needProfile?.id);
  const summaryText = `恭喜你，测出来你是属于稀有度${selfRarityLabel}的${computed.selfProfile?.name}型恋爱人格，和你最匹配的是稀有度${needRarityLabel}的${computed.needProfile?.name}型恋爱人格。`;
  formulaSummary.textContent = computed.formulaSummary;

  if (resultHeadingSummary) {
    resultHeadingSummary.textContent = computed.fromLinkSnapshot
      ? `（来自分享链接）${summaryText}`
      : summaryText;
  }

  selfResult.innerHTML = panelHtml('你的恋爱人格', computed.selfProfile, computed.selfConfidence, 'self');
  needResult.innerHTML = panelHtml('最和你匹配的类型', computed.needProfile, computed.needConfidence, 'need');

  const panelPalette = getResultPanelPalette(computed.gender);
  selfResult.style.background = panelPalette.self.background;
  selfResult.style.borderColor = panelPalette.self.border;
  needResult.style.background = panelPalette.match.background;
  needResult.style.borderColor = panelPalette.match.border;

  resultTags.innerHTML = computed.resultTags.map((tag) => `<span>${tag}</span>`).join('');
  resultNote.textContent = computed.note;

  if (resultCatalogIntro) {
    const profileCount = Object.keys(profiles).length;
    resultCatalogIntro.textContent = `下面这${profileCount}个类型，既可能是你自己，也可能是最和你匹配的恋人类型；点开卡片还能继续看完整详情。`;
  }

  profileCatalog.innerHTML = Object.values(profiles)
    .map((profile) => catalogHtml(profile, computed.selfProfile.id, computed.needProfile.id))
    .join('');

  lastComputed = computed;
  autoShareOpened = false;
  shareModalSlides = [];
  activeShareSlideIndex = 0;
  shareAssetCache = null;
  shareAssetPromises = null;
  floatingShareActions?.classList.remove('hidden');

  if (!computed.fromLinkSnapshot) {
    syncCanonicalUrl(computed);
  }

  autoOpenShare(computed);
};


const renderResult = (payload) => {
  const computed = calculateResults({ answers: payload.answers, zodiac: payload.zodiac || payload.mbti, gender: payload.gender });
  renderComputedView(computed);
};





const handleShareButtonPreview = async (button, originalText, variant = 'self') => {
  if (!lastComputed || !button) return;

  button.disabled = true;
  setFloatingButtonLabel(button, '生成中...');
  try {
    if (variant === 'match') {
      await openMatchSharePreview(lastComputed);
    } else {
      await openSelfSharePreview(lastComputed);
    }
  } catch (error) {
    console.error(`Failed to open ${variant} share preview:`, error);
    setFloatingButtonLabel(button, '生成失败，请重试');
    window.setTimeout(() => {
      setFloatingButtonLabel(button, originalText);
    }, 1600);
  } finally {
    button.disabled = false;
    if (button.querySelector('.floating-share-label')?.textContent === '生成中...') {
      setFloatingButtonLabel(button, originalText);
    }
  }
};

shareButton?.addEventListener('click', async () => {
  await handleShareButtonPreview(shareButton, '分享我的画像', 'self');
});

matchShareButton?.addEventListener('click', async () => {
  await handleShareButtonPreview(matchShareButton, '我的匹配对象', 'match');
});


shareIndicators?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-share-index]');
  if (!target) return;
  const nextIndex = Number(target.dataset.shareIndex);
  if (!Number.isFinite(nextIndex)) return;
  setActiveShareSlide(nextIndex);
});

sharePrevButton?.addEventListener('click', showPrevShareSlide);
shareNextButton?.addEventListener('click', showNextShareSlide);

shareGallery?.addEventListener('touchstart', (event) => {
  if (shareModalSlides.length <= 1) return;
  shareTouchStartX = event.changedTouches[0]?.clientX ?? null;
}, { passive: true });

shareGallery?.addEventListener('touchend', (event) => {
  if (shareModalSlides.length <= 1 || shareTouchStartX === null) return;

  const touchEndX = event.changedTouches[0]?.clientX ?? shareTouchStartX;
  const deltaX = touchEndX - shareTouchStartX;
  shareTouchStartX = null;

  if (Math.abs(deltaX) < 42) return;
  if (deltaX < 0) {
    showNextShareSlide();
    return;
  }
  showPrevShareSlide();
}, { passive: true });

shareClose?.addEventListener('click', closeShareModal);
shareBackdrop?.addEventListener('click', closeShareModal);

document.addEventListener('keydown', (event) => {
  if (shareModal?.classList.contains('hidden')) return;

  if (event.key === 'Escape') {
    closeShareModal();
  } else if (event.key === 'ArrowLeft') {
    showPrevShareSlide();
  } else if (event.key === 'ArrowRight') {
    showNextShareSlide();
  }
});

restartButton?.addEventListener('click', clearDataAndRestart);

bindShareGalleryCarouselPause();

const payload = loadPayload();
const urlParams = new URLSearchParams(window.location.search);
const hasLinkParams = Boolean(
  (urlParams.get('s') || urlParams.get('self'))
  && (urlParams.get('n') || urlParams.get('need')),
);
const linkComputed = hasLinkParams ? parseResultLinkParams(window.location.search) : null;

if (linkComputed && payload?.answers) {
  try {
    const fullComputed = calculateResults({
      answers: payload.answers,
      zodiac: payload.zodiac || payload.mbti,
      gender: payload.gender,
    });
    const samePair = fullComputed.selfProfile.id === linkComputed.selfProfile.id
      && fullComputed.needProfile.id === linkComputed.needProfile.id;
    if (samePair) {
      renderComputedView({ ...fullComputed, fromLinkSnapshot: false });
    } else {
      renderComputedView(linkComputed);
    }
  } catch (error) {
    console.error('Failed to render CPTI result from link + storage:', error);
    showEmptyState('badlink');
  }
} else if (linkComputed) {
  try {
    renderComputedView(linkComputed);
  } catch (error) {
    console.error('Failed to render CPTI result from link:', error);
    showEmptyState('badlink');
  }
} else if (hasLinkParams) {
  showEmptyState('badlink');
} else if (!payload || !payload.answers) {
  showEmptyState('default');
} else {
  try {
    renderResult(payload);
  } catch (error) {
    console.error('Failed to render CPTI result:', error);
    showEmptyState('default');
  }
}
