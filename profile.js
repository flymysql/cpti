const {
  profiles,
  getProfileRarityLabel,
  getProfileRarityRating,
  getProfileEaseRating,
} = window.CPTI_DATA;
const profileDetails = window.CPTI_PROFILE_DETAILS || {};
const profileDetailsEn = window.CPTI_PROFILE_DETAILS_EN || {};
const I18N = window.CPTI_I18N;
const L = (path) => I18N.t(path);

const profileEmpty = document.querySelector('#profile-empty');
const profileView = document.querySelector('#profile-view');

const sourceConfig = {
  home: { backHref: './index.html' },
  result: { backHref: './result.html' },
  self: { backHref: './result.html' },
  need: { backHref: './result.html' },
};

const avatarHtml = (profile, size = 'large') => {
  const lp = I18N.localizeProfile(profile);
  return `
  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${profile.avatarImage}" alt="${lp.name}" loading="lazy" />
  </div>
`;
};

const renderStars = (rating, total = 5) => Array.from({ length: total }, (_, index) => (
  `<span class='detail-star ${index < rating ? 'is-active' : ''}'>★</span>`
)).join('');


const defaultDetail = (profile) => {
  const lp = I18N.localizeProfile(profile);
  if (I18N.getLocale() === 'en') {
    return {
      essay: lp.detailEssay || `${lp.name} types carry a recognizable intimacy style — closeness, pacing, and how you signal needs.`,
      advice: Array.isArray(lp.advice) && lp.advice.length
        ? lp.advice
        : [
          `Keep your “${lp.tags?.[0] || 'core'}” — still translate it into words.`,
          `When “${lp.tags?.[1] || 'guard'}” hardens, ask for repair instead of proof.`,
          `Fit best with partners who like your “${lp.tags?.[2] || 'tempo'},” not only your best days.`,
        ],
    };
  }
  return {
    essay: profile.detailEssay || `${profile.name} 型通常会把自己的恋爱节奏、情绪表达和亲密需求放进很鲜明的相处风格里。你在关系中的表现并不是单一优点或单一短板，而是一整套相处习惯。理解自己的方式，不是为了给自己贴死标签，而是为了更早看见自己在爱里会怎么靠近、怎么退开、怎么表达喜欢，也知道什么样的关系更适合长期停留。`,
    advice: Array.isArray(profile.advice) && profile.advice.length
      ? profile.advice
      : [
        `保留你的「${profile.tags?.[0] || '底色'}」，但别让它代替沟通。`,
        `当「${profile.tags?.[1] || '防御'}」开始过头时，记得把真实需求说出来。`,
        `你更适合能接住你「${profile.tags?.[2] || '节奏'}」这一面的人，而不是只接住表面状态的人。`,
      ],
  };
};

const mergeProfileDetail = (targetProfile) => {
  const fallback = defaultDetail(targetProfile);
  const rawExtra = I18N.getLocale() === 'en'
    ? (profileDetailsEn[targetProfile.id] || profileDetails[targetProfile.id])
    : profileDetails[targetProfile.id];
  const extra = rawExtra;
  if (!extra) return { ...fallback, friction: '', earlySignals: '' };
  return {
    essay: extra.essay ?? fallback.essay,
    advice: Array.isArray(extra.advice) && extra.advice.length ? extra.advice : fallback.advice,
    friction: extra.friction || '',
    earlySignals: extra.earlySignals || '',
  };
};


const params = new URLSearchParams(window.location.search);
const profileId = params.get('id') || '';
const source = params.get('from') || 'home';
const sourceKey = ['home', 'result', 'self', 'need'].includes(source) ? source : 'home';

const profile = profiles[profileId];

const renderNotFound = () => {
  document.title = L('profile.notFoundDocTitle');
  profileEmpty.classList.remove('hidden');
  profileView.classList.add('hidden');
  const t = document.querySelector('#profile-empty-title');
  const c = document.querySelector('#profile-empty-copy');
  if (t) t.textContent = L('profile.emptyTitle');
  if (c) c.textContent = L('profile.emptyCopy');
};

const renderProfile = (targetProfile) => {
  const lp = I18N.localizeProfile(targetProfile);
  const detail = mergeProfileDetail(targetProfile);
  const descriptionMeta = document.querySelector('meta[name="description"]');

  document.title = typeof L('profile.docTitleTpl') === 'function' ? L('profile.docTitleTpl')(lp.name) : `CPTI | ${lp.name}`;
  const metaBits = [detail.friction, detail.earlySignals, lp.description].filter(Boolean);
  descriptionMeta?.setAttribute(
    'content',
    `${lp.name}: ${metaBits[0] || lp.description}`,
  );

  profileEmpty.classList.add('hidden');
  profileView.classList.remove('hidden');
  const rarityLabel = getProfileRarityLabel(targetProfile.id);
  const rarityRating = getProfileRarityRating(targetProfile.id);
  const easeRating = getProfileEaseRating(targetProfile.id);

  profileView.innerHTML = `
    <section class='detail-hero panel-card'>
      <div class='detail-hero-main'>
        ${avatarHtml(targetProfile, 'large')}
        <div class='detail-hero-copy'>

          <small>${targetProfile.code}</small>
          <h1>${lp.name}</h1>
          <div class='detail-metrics'>
            <div class='detail-metric'>
              <span class='detail-metric-label'>${L('profile.rarity')}</span>
              <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
              <span class='detail-stars' aria-label='${L('profile.rarity')} ${rarityRating}'>${renderStars(rarityRating)}</span>
            </div>
            <div class='detail-metric'>
              <span class='detail-metric-label'>${L('profile.ease')}</span>
              <span class='detail-stars' aria-label='${L('profile.ease')} ${easeRating}'>${renderStars(easeRating)}</span>
            </div>
          </div>
          <p class='detail-hero-lead'>${lp.description}</p>
          <p>${lp.longDescription}</p>
          <div class='tag-row compact'>
            ${lp.tags.map((tag) => `<span>${tag}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>


    <div class='detail-grid'>
      <article class='panel-card detail-section'>
        <span class='eyebrow'>${L('profile.sectionLoveEyebrow')}</span>
        <h2>${typeof L('profile.sectionLoveH2Tpl') === 'function' ? L('profile.sectionLoveH2Tpl')(lp.name) : lp.name}</h2>
        <p>${detail.essay}</p>
        <p class='detail-copy'>${lp.note}</p>
      </article>

      <article class='panel-card detail-section'>
        <span class='eyebrow'>${L('profile.sectionMatchEyebrow')}</span>
        <h2>${L('profile.sectionMatchH2')}</h2>

        <p>${lp.needDescription}</p>
        <p class='detail-copy'>${lp.needLongDescription}</p>
        <p>${lp.needNote}</p>
      </article>
    </div>

    ${detail.friction || detail.earlySignals ? `
    <section class='panel-card detail-section detail-extra-radar'>
      <span class='eyebrow'>${L('profile.radarEyebrow')}</span>
      <h2>${L('profile.radarH2')}</h2>
      ${detail.friction ? `<p>${detail.friction}</p>` : ''}
      ${detail.earlySignals ? `<p class='detail-copy'>${detail.earlySignals}</p>` : ''}
    </section>
    ` : ''}

    <section class='section-block compact-top detail-section-wrap'>
      <div class='section-heading narrow'>
        <h2>${typeof L('profile.adviceH2Tpl') === 'function' ? L('profile.adviceH2Tpl')(lp.name) : lp.name}</h2>

        <p>${L('profile.adviceLead')}</p>
      </div>

      <div class='feature-grid three detail-advice-grid'>
        ${detail.advice
          .map(
            (item, index) => `
              <article class='panel-card feature-card advice-card'>
                <span class='feature-index'>0${index + 1}</span>
                <p>${item}</p>
              </article>
            `
          )
          .join('')}
      </div>
    </section>

    <section class='panel-card detail-cta'>
      <div class='section-heading narrow'>
        <span class='eyebrow'>${L('profile.adviceEyebrow')}</span>
        <h2>${L('profile.ctaH2')}</h2>
        <p>${L('profile.ctaP')}</p>
      </div>
      <div class='detail-cta-actions'>
        <a class='primary-button' href='${I18N.withLang('./quiz.html')}'>${L('profile.ctaRetake')}</a>
        <a class='secondary-button' href='${I18N.withLang('./result.html')}'>${L('profile.ctaResult')}</a>
      </div>
    </section>
  `;
};


const applyProfileChrome = () => {
  document.querySelector('meta[name="description"]')?.setAttribute('content', L('profile.metaDesc'));
  document.querySelector('.brand')?.setAttribute('aria-label', L('profile.brandAria'));
  document.querySelector('.brand')?.setAttribute('href', I18N.withLang('./index.html'));
  document.querySelector('.topbar-actions')?.setAttribute('aria-label', L('common.topbarNavAria'));
  const brandSmall = document.querySelector('.brand-copy small');
  if (brandSmall) brandSmall.textContent = L('common.brandSmall');
  document.querySelectorAll('.topbar-actions .ghost-button, .topbar-actions .topbar-link').forEach((el) => {
    const href = el.getAttribute('href') || '';
    if (href.includes('index.html')) {
      el.textContent = L('common.home');
      el.setAttribute('href', I18N.withLang('./index.html'));
    }
    if (href.includes('quiz.html')) {
      el.textContent = L('common.quiz');
      el.setAttribute('href', I18N.withLang('./quiz.html'));
    }
    if (href.includes('result.html')) {
      el.textContent = L('common.result');
      el.setAttribute('href', I18N.withLang('./result.html'));
    }
  });
  const foot = document.querySelector('.footer.container p');
  if (foot) {
    foot.innerHTML = `${L('profile.footer')}<br><span class='author-highlight'>${L('common.author')}</span>`;
  }
  const pe = document.querySelector('#profile-empty .primary-button');
  const ps = document.querySelector('#profile-empty .secondary-button');
  if (pe) {
    pe.textContent = L('result.ctaHome');
    pe.setAttribute('href', I18N.withLang('./index.html'));
  }
  if (ps) {
    ps.textContent = L('result.ctaQuiz');
    ps.setAttribute('href', I18N.withLang('./quiz.html'));
  }
  document.documentElement.lang = I18N.getLocale() === 'en' ? 'en' : 'zh-CN';
};

applyProfileChrome();
I18N.mountLanguageSwitch();

if (!profile) {
  renderNotFound();
} else {
  renderProfile(profile);
}
