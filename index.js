const {
  profiles,
  questions,
  STORAGE,
  getProfileRarityLabel,
  resolveRasterAvatarThumbUrl,
  resolveRasterAvatarUrl,
  getSavedQuizGender,
} = window.CPTI_DATA;
const I18N = window.CPTI_I18N;
const L = (path) => I18N.t(path);


const homeCatalog = document.querySelector('#home-catalog');
const homeCatalogEmpty = document.querySelector('#home-catalog-empty');
const homeCatalogHeading = document.querySelector('#home-catalog-heading');
const topbarAvatarWall = document.querySelector('#topbar-avatar-wall');
const sampleFormulaTitle = document.querySelector('#sample-formula-title');
const sampleFormulaCopy = document.querySelector('#sample-formula-copy');
const homeQuestionCount = document.querySelector('#home-question-count');
const homeProfileCount = document.querySelector('#home-profile-count');
const homeCatalogTitle = document.querySelector('#home-catalog-title');

/** Matches `resolveRasterAvatarUrl` second arg for the latest home catalog render (hydration). */
let homeCatalogAvatarGenderArg = '';

const escAttr = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;');

const samplePair = {
  self: 'lovebrain',
  need: 'daddy',
};


const avatarHtml = (profile, size = 'small', listOptions = {}) => {
  const lp = I18N.localizeProfile(profile);
  const {
    quizCompleted = false,
    userGender = '',
    hydrateCatalogFull = false,
  } = listOptions;
  const thumbSrc = resolveRasterAvatarThumbUrl(profile.id, { quizCompleted, userGender });
  const catalogImgClass = hydrateCatalogFull ? ' class="home-catalog-avatar-img"' : '';
  return `
  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${escAttr(thumbSrc)}" alt="${escAttr(lp.name)}" loading="lazy" decoding="async"${catalogImgClass} />
  </div>
`;
};

const profileDetailHref = (id, source = 'home') => I18N.withLang(`./profile.html?id=${encodeURIComponent(id)}&from=${encodeURIComponent(source)}`);

const topbarAvatarItemHtml = (profile, listOptions) => {
  const lp = I18N.localizeProfile(profile);
  return `
  <div
    class='topbar-avatar-wall-item'
    aria-hidden='true'
    title='${lp.name}'
    style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'
  >
    ${avatarHtml(profile, 'small', listOptions)}
  </div>
`;
};

const topbarAvatarRowHtml = (rowProfiles, rowIndex, listOptions) => {
  const rowItems = rowProfiles.map((profile) => topbarAvatarItemHtml(profile, listOptions)).join('');
  const directionClass = rowIndex % 2 === 0 ? 'is-forward' : 'is-reverse';

  return `
    <div class='topbar-avatar-wall-row ${directionClass}' style='--wall-duration:${20 + rowIndex * 2}s; --wall-delay:${rowIndex * -2.4}s;'>
      <div class='topbar-avatar-wall-track'>
        <div class='topbar-avatar-wall-group'>${rowItems}</div>
        <div class='topbar-avatar-wall-group'>${rowItems}</div>
      </div>
    </div>
  `;
};


const topbarAvatarWallHtml = (allProfiles, rowCount = 4, listOptions) => {
  const perRow = Math.ceil(allProfiles.length / rowCount);

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowProfiles = allProfiles.slice(rowIndex * perRow, (rowIndex + 1) * perRow);
    return rowProfiles.length ? topbarAvatarRowHtml(rowProfiles, rowIndex, listOptions) : '';
  }).join('');
};

const fullCardHtml = (profile, listOptions) => {
  const lp = I18N.localizeProfile(profile);
  const rarityLabel = getProfileRarityLabel(profile.id);
  return `


  <a
    class='catalog-card home-catalog-card profile-card-link'
    data-profile-id='${profile.id}'
    href='${profileDetailHref(profile.id, 'home')}'
    aria-label='${L('index.cardAriaTpl')(lp.name)}'
    style='--card-accent:${profile.accent}; --card-soft:${profile.soft};'
  >
    <span class='catalog-card-foil' aria-hidden='true'></span>
    <div class='catalog-card-top'>
      ${avatarHtml(profile, 'small', listOptions)}
    </div>
    <div class='catalog-card-copy'>
      <div class='catalog-name-row'>
        <h3>${lp.name}</h3>
        <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
      </div>
    </div>
    <p>${lp.note}</p>
    <div class='tag-row compact'>
      ${lp.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('')}
    </div>
    <div class='catalog-card-footer'>
      <span class='profile-link-hint'>${L('index.cardHint')}</span>
    </div>
  </a>
`;
};


const lockedCardHtml = (title, copy) => `
  <div class='catalog-card home-catalog-card is-locked'>
    <span class='catalog-card-foil' aria-hidden='true'></span>
    <div class='catalog-card-top'>
      <div class='avatar-shell small locked-avatar'>
        <span class='locked-icon'>?</span>
      </div>
    </div>
    <div class='catalog-card-copy'>
      <small class='catalog-card-series'>CPTI</small>
      <h3>${title}</h3>
    </div>
    <p>${copy}</p>
    <div class='catalog-card-footer'>
      <span class='locked-hint'>${L('index.lockedHint')}</span>
    </div>
  </div>
`;



const hasCompletedQuiz = () => {
  try {
    const raw = localStorage.getItem(STORAGE.resultKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.answers && Object.keys(parsed.answers).length > 0);
  } catch (error) {
    return false;
  }
};

const renderHome = () => {
  const allProfiles = Object.values(profiles);
  const completed = hasCompletedQuiz();
  const userGender = getSavedQuizGender();
  homeCatalogAvatarGenderArg = userGender;
  const quizGenderLocked = userGender === 'male' || userGender === 'female' || userGender === 'nonbinary';
  const listOptions = { quizCompleted: quizGenderLocked, userGender };

  if (homeCatalogHeading) {
    homeCatalogHeading.classList.remove('hidden');
  }

  if (homeCatalogEmpty) {
    homeCatalogEmpty.classList.add('hidden');
  }

  if (homeCatalog) {
    const previewOrder = ['daddy', 'kitten', 'foodie', 'simp', 'lovebrain', 'siren'];
    const orderedProfiles = [
      ...previewOrder
        .map((id) => allProfiles.find((profile) => profile.id === id))
        .filter(Boolean),
      ...allProfiles.filter((profile) => !previewOrder.includes(profile.id)),
    ];
    const previewProfiles = completed ? orderedProfiles : orderedProfiles.slice(0, 6);
    const lockedCards = completed
      ? ''
      : `${lockedCardHtml(L('index.lockedTitleA'), L('index.lockedCopyA'))}${lockedCardHtml(L('index.lockedTitleB'), L('index.lockedCopyBTpl')(allProfiles.length))}`;



    const catalogListOptions = { ...listOptions, hydrateCatalogFull: true };
    homeCatalog.innerHTML = previewProfiles.map((profile) => fullCardHtml(profile, catalogListOptions)).join('') + lockedCards;
  }

  if (topbarAvatarWall) {
    topbarAvatarWall.innerHTML = topbarAvatarWallHtml(allProfiles, 4, listOptions);
  }


  if (homeQuestionCount) homeQuestionCount.textContent = String(questions.length);

  if (homeProfileCount) homeProfileCount.textContent = String(allProfiles.length);

  const nP = allProfiles.length;
  if (homeCatalogTitle) {
    homeCatalogTitle.textContent = typeof L('index.catalogTitleTpl') === 'function'
      ? L('index.catalogTitleTpl')(nP)
      : `先认识这${nP}种恋爱人格`;
  }

  scheduleHomeCatalogAvatarHydrate();
};


/** After window load + idle, swap catalog thumbs for full-size URLs (HTTP cache helps profile/result later). */
const scheduleHomeCatalogAvatarHydrate = () => {
  if (!homeCatalog) return;

  const hydrate = () => {
    homeCatalog.querySelectorAll('a.home-catalog-card.profile-card-link[data-profile-id] img.home-catalog-avatar-img').forEach((img) => {
      if (!(img instanceof HTMLImageElement) || img.dataset.avatarHydrated === '1') return;
      const link = img.closest('a[data-profile-id]');
      const id = link?.getAttribute('data-profile-id');
      if (!id) return;
      const full = resolveRasterAvatarUrl(id, homeCatalogAvatarGenderArg);
      const loader = new Image();
      loader.onload = () => {
        img.src = full;
        img.dataset.avatarHydrated = '1';
      };
      loader.onerror = () => {
        img.dataset.avatarHydrated = 'error';
      };
      loader.src = full;
    });
  };

  const kick = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => hydrate(), { timeout: 2800 });
    } else {
      window.setTimeout(hydrate, 400);
    }
  };

  if (document.readyState === 'complete') {
    kick();
  } else {
    window.addEventListener('load', kick, { once: true });
  }
};


const applyIndexChrome = () => {
  document.title = L('index.docTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', L('index.metaDesc'));
  document.querySelector('.brand')?.setAttribute('aria-label', L('index.brandAria'));
  document.querySelector('.brand')?.setAttribute('href', I18N.withLang('./index.html'));
  document.querySelector('.topbar-actions')?.setAttribute('aria-label', L('common.topbarNavAria'));
  const brandSmall = document.querySelector('.brand-copy small');
  if (brandSmall) brandSmall.textContent = L('common.brandSmall');
  const heroH1 = document.querySelector('.home-hero h1');
  if (heroH1) heroH1.innerHTML = L('index.heroH1Html');
  const resLink = document.querySelector('.topbar-actions .topbar-link');
  if (resLink) {
    resLink.textContent = L('common.myResult');
    resLink.setAttribute('href', I18N.withLang('./result.html'));
  }
  const heroLead = document.querySelector('#home-hero-lead');
  if (heroLead) heroLead.textContent = L('index.heroLead');
  const heroStart = document.querySelector('.hero-start-button span');
  if (heroStart) heroStart.textContent = L('index.heroStart');
  const heroStartA = document.querySelector('.hero-start-button');
  if (heroStartA) heroStartA.setAttribute('href', I18N.withLang('./quiz.html'));
  const catEyebrow = document.querySelector('#home-catalog-heading .eyebrow');
  const catDesc = document.querySelector('#home-catalog-desc');
  if (catEyebrow) catEyebrow.textContent = L('index.catalogEyebrow');
  if (catDesc) catDesc.textContent = L('index.catalogDesc');
  const sections = document.querySelectorAll('main > .section-block.compact-top');
  const featSection = sections[1];
  if (featSection) {
    const sh = featSection.querySelector('.section-heading');
    if (sh) {
      const eb = sh.querySelector('.eyebrow');
      const h2 = sh.querySelector('h2');
      const p = sh.querySelector('p');
      if (eb) eb.textContent = L('index.sectionEyebrow');
      if (h2) h2.textContent = L('index.sectionH2');
      if (p) p.textContent = L('index.sectionP');
    }
    const cards = featSection.querySelectorAll('.feature-card');
    if (cards[0]) {
      const h3 = cards[0].querySelector('h3');
      const p = cards[0].querySelector('p');
      if (h3) h3.textContent = L('index.f1h');
      if (p) p.textContent = L('index.f1p');
    }
    if (cards[1]) {
      const h3 = cards[1].querySelector('h3');
      const p = cards[1].querySelector('p');
      if (h3) h3.textContent = L('index.f2h');
      if (p) p.textContent = L('index.f2p');
    }
  }
  const foot = document.querySelector('.footer.container p');
  if (foot) {
    foot.innerHTML = `${L('index.footerHtml')}<br><span class='author-highlight'>${L('common.author')}</span>`;
  }
  document.documentElement.lang = I18N.getLocale() === 'en' ? 'en' : 'zh-CN';
};

applyIndexChrome();
I18N.mountLanguageSwitch();

renderHome();
