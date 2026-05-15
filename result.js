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
  resolveRasterAvatarUrl,
  resolveRasterAvatarThumbUrl,
} = window.CPTI_DATA;

const I18N = window.CPTI_I18N;
const L = (path) => I18N.t(path);



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
const profileCatalog = document.querySelector('#profile-catalog');
const resultEmptyTitle = document.querySelector('#result-empty-title');
const resultEmptyCopy = document.querySelector('#result-empty-copy');
const resultCatalogIntro = document.querySelector('#result-catalog-intro');
const resultPageTitle = document.querySelector('#result-page-title');
const resultHeroEyebrow = document.querySelector('#result-hero-eyebrow');
const resultCatalogSection = document.querySelector('#result-catalog-section');

const resetShareViewerChrome = () => {
  document.title = L('result.docTitle');
  if (resultPageTitle) resultPageTitle.textContent = L('result.headingDefault');
  if (resultHeroEyebrow) resultHeroEyebrow.textContent = L('result.eyebrowDefault');
  resultCatalogSection?.classList.remove('hidden');
  shareButton?.classList.remove('hidden');
  matchShareButton?.classList.remove('hidden');
  document.body.classList.remove('is-share-viewer');
};

const applyShareViewerChrome = () => {
  document.title = L('result.docTitleTa');
  if (resultPageTitle) resultPageTitle.textContent = L('result.headingTa');
  if (resultHeroEyebrow) resultHeroEyebrow.textContent = L('result.eyebrowTa');
  resultCatalogSection?.classList.add('hidden');
  shareButton?.classList.add('hidden');
  matchShareButton?.classList.add('hidden');
  document.body.classList.add('is-share-viewer');
};

let lastComputed = null;
let autoShareOpened = false;
let shareGallerySlidePx = 0;
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
const SHARE_CELEBRATION_MS = 2800;

const maxShareGalleryImageCssHeight = () => {
  const vh = typeof window.visualViewport?.height === 'number'
    ? window.visualViewport.height
    : window.innerHeight;
  const v = Math.min(vh, window.innerHeight);
  return Math.max(120, v - 210);
};

const computeShareImageDisplayWidth = (img) => {
  if (!(img instanceof HTMLImageElement) || !img.naturalWidth || !img.naturalHeight) return 0;
  const maxH = maxShareGalleryImageCssHeight();
  const scale = Math.min(1, maxH / img.naturalHeight);
  return Math.ceil(img.naturalWidth * scale);
};

const clearShareGalleryLayoutStyles = () => {
  shareGallerySlidePx = 0;
  if (!shareGallery || !shareTrack) return;
  shareGallery.style.width = '';
  shareTrack.style.width = '';
  shareTrack.style.transform = '';
  shareTrack.querySelectorAll('.share-gallery-slide').forEach((slide) => {
    slide.style.flex = '';
    slide.style.width = '';
    slide.style.minWidth = '';
  });
};

const removeShareOpenCelebration = () => {
  document.querySelector('.share-celebration-layer')?.remove();
};

const startShareOpenCelebration = () => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  removeShareOpenCelebration();
  const layer = document.createElement('div');
  layer.className = 'share-celebration-layer';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#ff8fc3', '#8cbcff', '#ffd280', '#a8e6ff', '#c9b3ff', '#ffffff'];
  const burstCount = 3;
  for (let b = 0; b < burstCount; b += 1) {
    const cx = 16 + Math.random() * 68;
    const cy = 18 + Math.random() * 48;
    const rays = 20 + Math.floor(Math.random() * 8);
    for (let i = 0; i < rays; i += 1) {
      const p = document.createElement('span');
      p.className = 'share-celebration-spark';
      const ang = (Math.PI * 2 * i) / rays + (Math.random() - 0.5) * 0.35;
      const dist = 80 + Math.random() * 160;
      p.style.left = `${cx}%`;
      p.style.top = `${cy}%`;
      p.style.setProperty('--sx', `${Math.cos(ang) * dist}px`);
      p.style.setProperty('--sy', `${Math.sin(ang) * dist}px`);
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.animationDelay = `${b * 0.14 + Math.random() * 0.22}s`;
      layer.appendChild(p);
    }
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), SHARE_CELEBRATION_MS);
};

const getShareQrLandingUrl = () => {
  try {
    const u = new URL('./index.html', window.location.href);
    if (I18N.getLocale() === 'en') u.searchParams.set('lang', 'en');
    else u.searchParams.delete('lang');
    return u.href;
  } catch {
    return 'https://cpti.cc/';
  }
};

const syncCanonicalUrl = (computed) => {
  const qs = buildResultQueryString(computed);
  if (!qs) return;
  const url = new URL(window.location.href);
  const p = new URLSearchParams(qs);
  if (I18N.getLocale() === 'en') p.set('lang', 'en');
  else p.delete('lang');
  url.search = p.toString();
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
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
  resetShareViewerChrome();
  resultEmpty?.classList.remove('hidden');
  resultView?.classList.add('hidden');
  floatingShareActions?.classList.add('hidden');
  if (resultEmptyTitle) {
    resultEmptyTitle.textContent = reason === 'badlink' ? L('result.emptyTitleBad') : L('result.emptyTitle');
  }
  if (resultEmptyCopy) {
    resultEmptyCopy.textContent = reason === 'badlink'
      ? L('result.emptyCopyBad')
      : L('result.emptyCopy');
  }
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

const avatarHtml = (profile, size = 'large', gender = '') => {
  const lp = I18N.localizeProfile(profile);
  const src = resolveRasterAvatarUrl(profile.id, gender);
  return `

  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${src}" alt="${lp.name}" loading="lazy" />
  </div>
`;
};

const heroCastAvatarHtml = (profile, positionClass, gender = '') => {
  const lp = I18N.localizeProfile(profile);
  const src = resolveRasterAvatarUrl(profile.id, gender);
  return `
  <div class='result-hero-character ${positionClass}'>
    <div class='result-hero-character-bob'>
      <div class='avatar-shell small result-hero-avatar' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
        <img src="${src}" alt="${lp.name}" loading="lazy" />
      </div>
    </div>
  </div>
`;
};

const renderResultHeroCast = (selfProfile, needProfile, gender = '') => {
  if (!resultHeroCast) return;
  if (!selfProfile || !needProfile) {
    resultHeroCast.innerHTML = '';
    return;
  }

  resultHeroCast.removeAttribute('hidden');
  resultHeroCast.innerHTML = `
    ${heroCastAvatarHtml(selfProfile, 'is-left', gender)}
    <span class='result-hero-heart' aria-hidden='true'>❤</span>
    ${heroCastAvatarHtml(needProfile, 'is-right', matchRasterGenderForUser(gender))}
  `;
};

const profileDetailHref = (id, source = 'result') => I18N.withLang(`./profile.html?id=${encodeURIComponent(id)}&from=${encodeURIComponent(source)}`);


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

const panelHtml = (title, profile, confidence, mode, gender = '') => {

  const isNeedMode = mode === 'need';
  const avatarRasterGender = isNeedMode ? matchRasterGenderForUser(gender) : gender;
  const lp = I18N.localizeProfile(profile);
  const description = isNeedMode
    ? (I18N.getLocale() === 'en' ? I18N.taifyNeedEn(lp.description) : taifyCopy(lp.description))
    : lp.description;
  const longDescription = isNeedMode
    ? (I18N.getLocale() === 'en' ? I18N.taifyNeedEn(lp.longDescription) : taifyCopy(lp.longDescription))
    : lp.longDescription;
  const note = isNeedMode
    ? (I18N.getLocale() === 'en' ? I18N.taifyNeedEn(lp.note) : taifyCopy(lp.note))
    : lp.note;
  const rarityLabel = getProfileRarityLabel(profile.id);
  const rarityRating = getProfileRarityRating(profile.id);
  const easeRating = getProfileEaseRating(profile.id);
  const confidenceRating = getConfidenceRating(confidence);

  return `
    <div class='result-panel-head'>
      <span class='mini-badge'>${title}</span>
      ${avatarHtml(profile, 'large', avatarRasterGender)}
      <div class='result-panel-copy'>
        <h3>${lp.name}</h3>
        <div class='result-metrics'>
          <div class='result-metric'>
            <span class='result-metric-label'>${L('result.rarity')}</span>
            <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
            <span class='detail-stars' aria-label='${L('result.rarity')} ${rarityRating}'>${renderStars(rarityRating)}</span>
          </div>
          <div class='result-metric'>
            <span class='result-metric-label'>${L('result.ease')}</span>
            <span class='detail-stars' aria-label='${L('result.ease')} ${easeRating}'>${renderStars(easeRating)}</span>
          </div>
        </div>
        <div class='result-metric is-score'>
          <span class='result-metric-label'>${L('result.fit')}</span>
          <span class='detail-stars' aria-label='${L('result.fit')} ${confidence}%'>${renderStars(confidenceRating)}</span>
        </div>

      </div>
    </div>
    <p>${description}</p>
    ${longDescription ? `<p class='detail-copy'>${longDescription}</p>` : ''}
    <p class='panel-note'>${note}</p>
    <div class='result-tag-row'>
      <div class='tag-row compact'>
        ${lp.tags.map((tag) => `<span>${tag}</span>`).join('')}
      </div>
      <a class='result-detail-button' href='${profileDetailHref(profile.id, 'result')}' aria-label='${L('result.detailAriaTpl')(lp.name)}'>${L('result.detailCta')}</a>
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
  ctx.font = '600 17px "Noto Sans SC", sans-serif';
  ctx.fillStyle = muted;
  ctx.fillText(label, x + w / 2, y + 24);
  ctx.font = '800 32px Outfit, "Noto Sans SC", sans-serif';
  ctx.fillStyle = primary;
  ctx.fillText(String(value), x + w / 2, y + 56);
  ctx.font = '600 14px "Noto Sans SC", sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(sub, x + w / 2, y + 82);
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

/** Opposite binary line for *match* portraits (hero / panels / share); catalog uses per-profile rules. */
const matchRasterGenderForUser = (rawGender = '') => {
  const g = normalizeGender(rawGender);
  return g === 'male' ? 'female' : 'male';
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
    roleLabel: variant === 'match' ? L('shareCard.roleMatch') : L('shareCard.roleSelf'),

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

  const Sk = (key) => L(`shareCard.${key}`);
  const Skf = (key, ...args) => {
    const v = L(`shareCard.${key}`);
    return typeof v === 'function' ? v(...args) : v;
  };

  const themeVariant = options.themeVariant || 'self';
  const {
    subtitleText = themeVariant === 'match' ? Sk('subtitleMatch') : Sk('subtitleSelf'),
    footerText = themeVariant === 'match' ? Sk('footerMatch') : Sk('footerSelf'),
    compareProfiles = null,
  } = options;


  const selfProfile = computed.selfProfile;
  const lpSelf = I18N.localizeProfile(selfProfile);
  const qrTargetUrl = getShareQrLandingUrl();
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
  const statHeight = 94;
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
  const adaptProfileCopy = (text = '') => {
    if (themeVariant === 'match') {
      return I18N.getLocale() === 'en' ? I18N.taifyNeedEn(text) : text.replace(/你/g, 'Ta');
    }
    return text;
  };
  const introText = adaptProfileCopy(lpSelf.description || Sk('introFallbackSelf'));
  const skillText = adaptProfileCopy(
    [lpSelf.longDescription, lpSelf.note].filter(Boolean).join(' ') || Sk('skillFallbackSelf'),
  );

  const cardIdText = `CPTI-${String(selfProfile.id || 'SELF').toUpperCase()}`;


  const tags = (lpSelf.tags || []).slice(0, 4);
  const easeRating = getEaseRating(selfProfile);
  const rarityRating = getRarityRating(selfProfile, themeVariant === 'match' ? 'need' : 'self');
  const rarityLabelCard = getRarityLabel(selfProfile);
  const easePanelHeight = 90;
  const rarityPanelHeight = 90;


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

  const drawAvatarPortrait = async ({
    profile,
    frameX,
    frameY,
    frameSize,
    title,
    name,
    mode = 'self',
    avatarSrc,
  }) => {
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
    const yOff = isComparePortrait ? 4 : 8;
    const clipSide = Math.min(frameSize * 0.88, polyOuterR * 2 - 6);
    const clipX = centerX - clipSide / 2;
    const clipY = centerY - clipSide / 2 - yOff;
    const clipR = Math.max(12, Math.min(30, clipSide * 0.11));

    ctx.save();
    ctx.globalAlpha = 0.5;
    drawRoundedRect(ctx, clipX - 10, clipY - 10, clipSide + 20, clipSide + 20, clipR + 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.restore();

    const avatarZoom = isComparePortrait ? 1.08 : 1.2;
    const drawSize = clipSide * avatarZoom;
    const drawX = centerX - drawSize / 2;
    const drawY = centerY - drawSize / 2 - yOff;
    try {
      const avatar = await loadImage(avatarSrc || profile.avatarImage);
      ctx.save();
      drawRoundedRect(ctx, clipX, clipY, clipSide, clipSide, clipR);
      ctx.clip();
      const faceGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, clipSide * 0.55);
      faceGrad.addColorStop(0, 'rgba(255, 252, 255, 0.98)');
      faceGrad.addColorStop(1, 'rgba(255, 236, 246, 0.96)');
      ctx.fillStyle = faceGrad;
      drawRoundedRect(ctx, clipX, clipY, clipSide, clipSide, clipR);
      ctx.fill();
      ctx.drawImage(avatar, drawX, drawY, drawSize, drawSize);
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, clipX, clipY, clipSide, clipSide, clipR);
      ctx.strokeStyle = accent;
      ctx.lineWidth = isComparePortrait ? 3 : 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, clipX + 1, clipY + 1, clipSide - 2, clipSide - 2, Math.max(8, clipR - 2));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = isComparePortrait ? 1.25 : 1.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
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
  const nameLines = getLines(ctx, lpSelf.name, portraitWidth - 72);
  ctx.font = `${subtitleFontSize}px "Noto Sans SC", sans-serif`;
  const subtitleLines = getLines(ctx, subtitleText, portraitWidth - 88);
  const introLines = getLines(ctx, introText, contentWidth);
  const skillLinesRaw = getLines(ctx, skillText, contentWidth);
  const skillLines = skillLinesRaw.slice(0, 5);

  ctx.font = '600 16px "Noto Sans SC", sans-serif';
  const typeLineFull = `${selfProfile.abbr || '—'}｜${rarityLabelCard} · ${Sk('typeLineSuffix')}`;
  const typeLines = getLines(ctx, typeLineFull, portraitWidth - 36);
  const tcgTypeHeight = typeLines.length * 22 + 10;
  const tcgBattleHeight = 100;
  const flavorPreview = (lpSelf.note || '').trim().slice(0, 80);
  ctx.font = `${bodyFontSize}px "Noto Sans SC", sans-serif`;
  const flavorLines = flavorPreview
    ? getLines(ctx, `${Sk('flavorPrefix')}${flavorPreview}`, contentWidth - 4).slice(0, 2)
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
    Math.max(easePanelHeight, rarityPanelHeight) +
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
    text: Sk('banner'),

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
    text: Skf('rareBadgeTpl', rarityLabelCard),
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
      title: Sk('portraitSelf'),
      name: I18N.localizeProfile(compareProfiles.left).name,
      mode: 'self',
      avatarSrc: resolveRasterAvatarUrl(compareProfiles.left.id, selectedGender),
    });
    await drawAvatarPortrait({
      profile: compareProfiles.right,
      frameX: rightFrameX,
      frameY: compareFrameY,
      frameSize: avatarFrameSize,
      title: Sk('portraitMatch'),
      name: I18N.localizeProfile(compareProfiles.right).name,
      mode: 'need',
      avatarSrc: resolveRasterAvatarUrl(compareProfiles.right.id, matchRasterGenderForUser(selectedGender)),
    });


    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px "Noto Sans SC", sans-serif';
    ctx.fillText(Sk('compareVs'), innerPortraitX + innerPortraitWidth / 2, compareFrameY + avatarFrameSize / 2 + 4);
  } else {

    const avatarFrameX = innerPortraitX + (innerPortraitWidth - avatarFrameSize) / 2;
    const avatarFrameY = innerPortraitY + (innerPortraitHeight - avatarFrameSize) / 2;
    await drawAvatarPortrait({
      profile: selfProfile,
      frameX: avatarFrameX,
      frameY: avatarFrameY,
      frameSize: avatarFrameSize,
      mode: 'self',
      avatarSrc: resolveRasterAvatarUrl(selfProfile.id, selectedGender),
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
    label: Sk('statFavor'),
    value: atk,
    sub: Sk('statFavorSub'),
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    primary: primaryText,
    muted: mutedText,
    accent,
  });
  drawTcgStatPlate(ctx, rowX0 + colW + colGap, cursorY, colW, tcgBattleHeight, {
    label: Sk('statGuard'),
    value: def,
    sub: Sk('statGuardSub'),
    fill: cardTheme.panelFill,
    stroke: cardTheme.panelStroke,
    primary: primaryText,
    muted: mutedText,
    accent,
  });
  drawTcgStatPlate(ctx, rowX0 + (colW + colGap) * 2, cursorY, colW, tcgBattleHeight, {
    label: Sk('statBond'),
    value: bond,
    sub: Sk('statBondSub'),
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
    { x: statX1, label: Sk('collId'), value: cardIdText },
    { x: statX2, label: Sk('pulseFit'), value: `${computed.selfConfidence}%` },
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
    ctx.font = '600 17px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + statWidth / 2, statY + 26);
    ctx.fillStyle = primaryText;
    ctx.font = '700 28px "Noto Sans SC", sans-serif';
    ctx.fillText(value, x + statWidth / 2, statY + 64);
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
  ctx.font = '600 17px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(Sk('ease'), easePanelX + infoPanelWidth / 2, cursorY + 26);

  const starOuter = 14.2;
  const starInner = 7.1;
  const starGap = 15;
  const starTotalWidth = 5 * starOuter * 2 + 4 * starGap;
  const starStartX = easePanelX + (infoPanelWidth - starTotalWidth) / 2 + starOuter;
  const starY = cursorY + 58;
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
  ctx.font = '600 17px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(Sk('rarity'), rarityPanelX + infoPanelWidth / 2, cursorY + 26);

  const rarityStarOuter = 14.2;
  const rarityStarInner = 7.1;
  const rarityStarGap = 15;
  const rarityStarTotalWidth = 5 * rarityStarOuter * 2 + 4 * rarityStarGap;
  const rarityStarStartX = rarityPanelX + (infoPanelWidth - rarityStarTotalWidth) / 2 + rarityStarOuter;
  const rarityStarY = cursorY + 58;
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
    ctx.fillText(Sk('keywords'), cardX + cardPadding, cursorY + 14);
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
    title: Sk('bioTitle'),
    lines: introLines,
  });

  cursorY += introHeightDrawn + panelGap;

  const skillHeightDrawn = drawInfoPanel({
    x: cardX + cardPadding,
    y: cursorY,
    width: portraitWidth,
    title: Sk('skillTitle'),
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
  ctx.fillText(Sk('footerBrand'), cardX + cardPadding, footerY + 20);
  ctx.fillStyle = primaryText;
  ctx.font = '700 24px "Noto Sans SC", sans-serif';
  ctx.fillText(Sk('footerLabTitle'), cardX + cardPadding, footerY + 52);
  ctx.fillStyle = secondaryText;
  ctx.font = '18px "Noto Sans SC", sans-serif';
  ctx.fillText(footerText, cardX + cardPadding, footerY + 86);
  ctx.fillStyle = mutedText;

  ctx.font = '16px "Noto Sans SC", sans-serif';
  ctx.fillText(Sk('footerFinePrint'), cardX + cardPadding, footerY + 126);

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
    themeVariant: 'match',
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
  const sp = computed?.selfProfile ? I18N.localizeProfile(computed.selfProfile) : null;
  const np = computed?.needProfile ? I18N.localizeProfile(computed.needProfile) : null;
  const slides = [];
  if (selfDataUrl) {
    slides.push({
      id: 'self',
      title: L('shareCard.slideTitleSelf'),
      subtitle: sp?.name || L('shareCard.slideSubSelf'),
      alt: typeof L('shareCard.slideAltSelfTpl') === 'function'
        ? L('shareCard.slideAltSelfTpl')(sp?.name)
        : `${sp?.name || ''} share`,
      dataUrl: selfDataUrl,
    });
  }
  if (matchDataUrl) {
    slides.push({
      id: 'match',
      title: L('shareCard.slideTitleMatch'),
      subtitle: np?.name || L('shareCard.slideSubMatch'),
      alt: typeof L('shareCard.slideAltMatchTpl') === 'function'
        ? L('shareCard.slideAltMatchTpl')(np?.name)
        : `${np?.name || ''} share`,
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

const syncShareModalWithCachedSlides = (computed, preferredSlideId = null, modalOptions = {}) => {
  const slides = getCachedShareSlides(computed, {
    includeSelf: true,
    includeMatch: true,
  });
  if (!slides.length) return false;

  const activeSlideId = preferredSlideId || shareModalSlides[activeShareSlideIndex]?.id || 'self';
  openShareModal(slides, getShareSlideIndex(slides, activeSlideId), modalOptions);
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
      aria-label='${L('result.shareSlideAriaTpl')(index + 1, slide.title)}'
      aria-pressed='${index === activeShareSlideIndex ? 'true' : 'false'}'
    ></button>
  `).join('');
};

const updateShareGallery = () => {
  if (!shareTrack) return;

  if (shareGallerySlidePx > 0) {
    shareTrack.style.transform = `translateX(-${activeShareSlideIndex * shareGallerySlidePx}px)`;
  } else {
    shareTrack.style.transform = `translateX(-${activeShareSlideIndex * 100}%)`;
  }
  renderShareIndicators();
};

const syncShareGalleryLayoutMetrics = () => {
  if (!shareGallery || !shareTrack || shareModal?.classList.contains('hidden')) return;
  const slideEls = shareTrack.querySelectorAll('.share-gallery-slide');
  if (!slideEls.length) return;

  let maxDisp = 0;
  slideEls.forEach((slide) => {
    const im = slide.querySelector('img.share-gallery-image');
    const w = im ? computeShareImageDisplayWidth(im) : 0;
    if (w > maxDisp) maxDisp = w;
  });

  const cap = Math.floor(window.innerWidth * 0.96 - 20);
  const maxW = Math.min(maxDisp, cap);
  if (maxW < 40) {
    shareGallerySlidePx = 0;
    updateShareGallery();
    return;
  }

  shareGallerySlidePx = maxW;
  const n = slideEls.length;
  slideEls.forEach((slide) => {
    slide.style.flex = `0 0 ${maxW}px`;
    slide.style.width = `${maxW}px`;
    slide.style.minWidth = `${maxW}px`;
  });
  shareTrack.style.width = `${n * maxW}px`;
  shareGallery.style.width = `${maxW}px`;
  updateShareGallery();
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

  clearShareGalleryLayoutStyles();

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

  activeShareSlideIndex = Math.max(0, Math.min(activeShareSlideIndex, shareModalSlides.length - 1));
  shareTrack.querySelectorAll('img.share-gallery-image').forEach((im) => {
    const run = () => syncShareGalleryLayoutMetrics();
    if (im.complete) queueMicrotask(run);
    else im.addEventListener('load', run, { once: true });
  });
  syncShareGalleryLayoutMetrics();
  renderShareIndicators();
  scheduleShareCarousel();
};

const openShareModal = (slides, startIndex = 0, options = {}) => {
  if (!shareModal || !shareTrack || !slides?.length) return;

  const { celebrateOpening = false } = options;

  shareCarouselPaused = false;
  shareCarouselHoldActive = false;
  clearShareCarouselHoldTimer();
  activeShareSlideIndex = Math.max(0, Math.min(startIndex, slides.length - 1));
  renderShareGallery(slides);
  shareModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(() => {
    syncShareGalleryLayoutMetrics();
    if (celebrateOpening) {
      startShareOpenCelebration();
    }
  });
};

const closeShareModal = () => {
  shareTouchStartX = null;
  stopShareCarousel();
  shareCarouselPaused = false;
  shareCarouselHoldActive = false;
  clearShareCarouselHoldTimer();
  removeShareOpenCelebration();
  clearShareGalleryLayoutStyles();
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

const openSelfSharePreview = async (computed, { celebrateOpening = false } = {}) => {
  const selfDataUrl = await ensureShareAsset(computed, 'self');
  if (!selfDataUrl) {
    throw new Error('Self share image unavailable');
  }

  const openedFromCache = syncShareModalWithCachedSlides(computed, 'self', { celebrateOpening });
  if (!openedFromCache) {
    openShareModal(buildShareSlides(computed, selfDataUrl, null), 0, { celebrateOpening });
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
    await openSelfSharePreview(computed, { celebrateOpening: true });
  } catch (error) {
    console.error('Failed to generate auto self share preview:', error);
  }
};





const catalogBadges = (profile, selfId, needId) => {

  const badges = [];
  if (profile.id === selfId) badges.push(`<span class="catalog-flag self">${L('result.catalogBadgeSelf')}</span>`);
  if (profile.id === needId) badges.push(`<span class="catalog-flag need">${L('result.catalogBadgeNeed')}</span>`);
  return badges.join('');
};

const catalogHtml = (profile, selfId, needId, gender = '') => {
  const lp = I18N.localizeProfile(profile);
  const isSelf = profile.id === selfId;
  const isNeed = profile.id === needId;
  const cardClass = isSelf && isNeed ? 'catalog-card is-double-active' : isSelf || isNeed ? 'catalog-card is-active' : 'catalog-card';

  const rarityLabel = getProfileRarityLabel(profile.id);
  const thumbSrc = resolveRasterAvatarThumbUrl(profile.id, {
    quizCompleted: true,
    userGender: gender || '',
  });
  return `
    <a
      class='${cardClass} profile-card-link'
      href='${profileDetailHref(profile.id, 'result')}'
      aria-label='${L('result.catalogCardAriaTpl')(lp.name)}'
      style='--card-accent:${profile.accent}; --card-soft:${profile.soft};'
    >
      <span class='catalog-card-foil' aria-hidden='true'></span>
      <div class='catalog-card-top'>
        <div class='avatar-shell small' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
          <img src="${thumbSrc}" alt="${lp.name}" loading="lazy" />
        </div>
      </div>
      <div class='catalog-card-copy'>
        <div class='catalog-name-row'>
          <h3>${lp.name}</h3>
          <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
        </div>
        <div class='catalog-flag-row'>
          ${catalogBadges(profile, selfId, needId)}
        </div>
      </div>
      <p>${lp.description}</p>
      <div class='tag-row compact'>
        ${lp.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('')}
      </div>
      <div class='catalog-card-footer'>
        <span class='profile-link-hint'>${L('index.cardHint')}</span>
      </div>
    </a>
  `;
};


const renderComputedView = (incoming) => {
  if (!incoming?.selfProfile || !incoming?.needProfile) return;
  const computed = I18N.formatComputedCopy(incoming);

  resultEmpty?.classList.add('hidden');
  resultView?.classList.remove('hidden');

  formulaTitle.textContent = computed.formulaTitle;
  renderResultHeroCast(computed.selfProfile, computed.needProfile, computed.gender || '');
  const selfRarityLabel = getProfileRarityLabel(computed.selfProfile?.id);
  const needRarityLabel = getProfileRarityLabel(computed.needProfile?.id);
  const sp = I18N.localizeProfile(computed.selfProfile);
  const np = I18N.localizeProfile(computed.needProfile);
  const ownerHeadingSummary = I18N.getLocale() === 'en'
    ? L('shareCard.ownerSummaryTpl')(selfRarityLabel, sp.name, needRarityLabel, np.name)
    : `恭喜你，测出来你是属于稀有度${selfRarityLabel}的${computed.selfProfile?.name}型恋爱人格，和你最匹配的是稀有度${needRarityLabel}的${computed.needProfile?.name}型恋爱人格。`;
  formulaSummary.textContent = computed.formulaSummary;

  if (computed.fromLinkSnapshot) {
    applyShareViewerChrome();
    if (resultHeadingSummary) {
      resultHeadingSummary.textContent = computed.linkSnapshotHeadingIntro || '';
    }
  } else {
    resetShareViewerChrome();
    if (resultHeadingSummary) {
      resultHeadingSummary.textContent = ownerHeadingSummary;
    }
  }

  const selfPanelTitle = computed.fromLinkSnapshot ? L('result.selfPanelTa') : L('result.selfPanel');
  const needPanelTitle = computed.fromLinkSnapshot ? L('result.needPanelTa') : L('result.needPanel');
  selfResult.innerHTML = panelHtml(selfPanelTitle, computed.selfProfile, computed.selfConfidence, 'self', computed.gender || '');
  needResult.innerHTML = panelHtml(needPanelTitle, computed.needProfile, computed.needConfidence, 'need', computed.gender || '');

  const panelPalette = getResultPanelPalette(computed.gender);
  selfResult.style.background = panelPalette.self.background;
  selfResult.style.borderColor = panelPalette.self.border;
  needResult.style.background = panelPalette.match.background;
  needResult.style.borderColor = panelPalette.match.border;

  resultTags.innerHTML = [...sp.tags.slice(0, 2), ...np.tags.slice(0, 2)].map((tag) => `<span>${tag}</span>`).join('');
  resultNote.textContent = computed.note;

  if (resultCatalogIntro) {
    const profileCount = Object.keys(profiles).length;
    resultCatalogIntro.textContent = L('result.catalogIntroTpl')(profileCount);
  }

  if (computed.fromLinkSnapshot) {
    profileCatalog.innerHTML = '';
  } else {
    profileCatalog.innerHTML = Object.values(profiles)
      .map((profile) => catalogHtml(profile, computed.selfProfile.id, computed.needProfile.id, computed.gender || ''))
      .join('');
  }

  lastComputed = computed;
  autoShareOpened = false;
  shareModalSlides = [];
  activeShareSlideIndex = 0;
  shareAssetCache = null;
  shareAssetPromises = null;
  if (computed.fromLinkSnapshot) {
    floatingShareActions?.classList.add('hidden');
  } else {
    floatingShareActions?.classList.remove('hidden');
  }

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
  setFloatingButtonLabel(button, L('result.shareGenerating'));
  try {
    if (variant === 'match') {
      await openMatchSharePreview(lastComputed);
    } else {
      await openSelfSharePreview(lastComputed);
    }
  } catch (error) {
    console.error(`Failed to open ${variant} share preview:`, error);
    setFloatingButtonLabel(button, L('result.shareFailed'));
    window.setTimeout(() => {
      setFloatingButtonLabel(button, originalText);
    }, 1600);
  } finally {
    button.disabled = false;
    if (button.querySelector('.floating-share-label')?.textContent === L('result.shareGenerating')) {
      setFloatingButtonLabel(button, originalText);
    }
  }
};

shareButton?.addEventListener('click', async () => {
  await handleShareButtonPreview(shareButton, L('result.shareSelf'), 'self');
});

matchShareButton?.addEventListener('click', async () => {
  await handleShareButtonPreview(matchShareButton, L('result.shareMatch'), 'match');
});


shareIndicators?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-share-index]');
  if (!target) return;
  const nextIndex = Number(target.dataset.shareIndex);
  if (!Number.isFinite(nextIndex)) return;
  setActiveShareSlide(nextIndex);
});

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

bindShareGalleryCarouselPause();

const applyResultPageChrome = () => {
  document.title = L('result.docTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', L('result.metaDesc'));
  document.querySelector('.brand')?.setAttribute('aria-label', L('result.brandAria'));
  document.querySelector('.brand')?.setAttribute('href', I18N.withLang('./index.html'));
  document.querySelector('.topbar-actions')?.setAttribute('aria-label', L('common.topbarNavAria'));
  document.querySelectorAll('.topbar-actions .ghost-button, .topbar-actions .topbar-link').forEach((el) => {
    const href = el.getAttribute('href') || '';
    if (href.includes('quiz.html')) {
      el.textContent = L('common.quiz');
      el.setAttribute('href', I18N.withLang('./quiz.html'));
    }
  });
  const eq = document.querySelector('#result-empty .primary-button');
  const eh = document.querySelector('#result-empty .secondary-button');
  if (eq) {
    eq.textContent = L('result.ctaQuiz');
    eq.setAttribute('href', I18N.withLang('./quiz.html'));
  }
  if (eh) {
    eh.textContent = L('result.ctaHome');
    eh.setAttribute('href', I18N.withLang('./index.html'));
  }
  if (resultHeadingSummary && resultView?.classList.contains('hidden')) {
    resultHeadingSummary.textContent = L('result.headingLead');
  }
  const insightH3 = document.querySelectorAll('.result-insights .info-card h3');
  if (insightH3[0]) insightH3[0].textContent = L('result.insightTags');
  if (insightH3[1]) insightH3[1].textContent = L('result.insightNote');
  const catEyebrow = document.querySelector('#result-catalog-section .eyebrow');
  const catH2 = document.querySelector('#result-catalog-section .section-heading h2');
  if (catEyebrow) catEyebrow.textContent = L('result.catalogEyebrow');
  if (catH2) catH2.textContent = L('result.catalogH2');
  const shareTipEl = document.querySelector('.share-tip');
  if (shareTipEl) shareTipEl.textContent = L('result.shareTip');
  shareGallery?.setAttribute('aria-label', L('result.shareGalleryAria'));
  shareIndicators?.setAttribute('aria-label', L('result.shareIndicatorsAria'));
  shareBackdrop?.setAttribute('aria-label', L('result.shareModalClose'));
  shareClose?.setAttribute('aria-label', L('result.shareModalClose'));
  setFloatingButtonLabel(shareButton, L('result.shareSelf'));
  setFloatingButtonLabel(matchShareButton, L('result.shareMatch'));
  shareButton?.setAttribute('aria-label', L('result.shareSelfAria'));
  shareButton?.setAttribute('title', L('result.shareSelf'));
  matchShareButton?.setAttribute('aria-label', L('result.shareMatchAria'));
  matchShareButton?.setAttribute('title', L('result.shareMatch'));
  const foot = document.querySelector('.footer.container p');
  if (foot) {
    foot.innerHTML = `${L('common.footerDisclaimer')}<br><span class='author-highlight'>${L('common.authorHtml')}</span>`;
  }
  const brandSmall = document.querySelector('.brand-copy small');
  if (brandSmall) brandSmall.textContent = L('common.brandSmall');
};

applyResultPageChrome();
I18N.mountLanguageSwitch();

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
