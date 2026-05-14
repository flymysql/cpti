const { profiles, questions, STORAGE, getProfileRarityLabel } = window.CPTI_DATA;


const homeCatalog = document.querySelector('#home-catalog');
const homeCatalogEmpty = document.querySelector('#home-catalog-empty');
const homeCatalogHeading = document.querySelector('#home-catalog-heading');
const topbarAvatarWall = document.querySelector('#topbar-avatar-wall');
const sampleFormulaTitle = document.querySelector('#sample-formula-title');
const sampleFormulaCopy = document.querySelector('#sample-formula-copy');
const homeQuestionCount = document.querySelector('#home-question-count');
const homeProfileCount = document.querySelector('#home-profile-count');


const samplePair = {
  self: 'lovebrain',
  need: 'daddy',
};


const avatarHtml = (profile, size = 'small') => `
  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${profile.avatarImage}" alt="${profile.name} 头像" loading="lazy" />
  </div>
`;

const profileDetailHref = (id, source = 'home') => `./profile.html?id=${encodeURIComponent(id)}&from=${encodeURIComponent(source)}`;

const topbarAvatarItemHtml = (profile) => `
  <div
    class='topbar-avatar-wall-item'
    aria-hidden='true'
    title='${profile.name}'
    style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'
  >
    ${avatarHtml(profile, 'small')}
  </div>
`;

const topbarAvatarRowHtml = (rowProfiles, rowIndex) => {
  const rowItems = rowProfiles.map((profile) => topbarAvatarItemHtml(profile)).join('');
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


const topbarAvatarWallHtml = (allProfiles, rowCount = 4) => {
  const perRow = Math.ceil(allProfiles.length / rowCount);

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowProfiles = allProfiles.slice(rowIndex * perRow, (rowIndex + 1) * perRow);
    return rowProfiles.length ? topbarAvatarRowHtml(rowProfiles, rowIndex) : '';
  }).join('');
};

const fullCardHtml = (profile) => {
  const rarityLabel = getProfileRarityLabel(profile.id);
  return `


  <a
    class='catalog-card home-catalog-card profile-card-link'
    href='${profileDetailHref(profile.id, 'home')}'
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
    </div>
    <p>${profile.note}</p>
    <div class='tag-row compact'>
      ${profile.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('')}
    </div>
    <div class='catalog-card-footer'>
      <span class='profile-link-hint'>查看人格详情 →</span>
    </div>
  </a>
`;
};


const lockedCardHtml = (title, copy) => `
  <div class='catalog-card home-catalog-card is-locked'>
    <span class='catalog-card-foil' aria-hidden='true'></span>
    <div class='catalog-card-meta'>
      <span class='catalog-card-code'>LOCKED</span>
      <span class='catalog-card-rank'>????</span>
    </div>
    <div class='catalog-card-top'>
      <div class='avatar-shell small locked-avatar'>
        <span class='locked-icon'>?</span>
      </div>
    </div>
    <div class='catalog-card-copy'>
      <small class='catalog-card-series'>CPTI 隐藏卡</small>
      <h3>${title}</h3>
    </div>
    <p>${copy}</p>
    <div class='catalog-card-footer'>
      <span class='locked-hint'>完成测试即可解锁</span>
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

  if (homeCatalogHeading) {
    homeCatalogHeading.classList.remove('hidden');
  }

  if (homeCatalogEmpty) {
    homeCatalogEmpty.classList.add('hidden');
  }

  if (homeCatalog) {
    const previewProfiles = completed ? allProfiles : allProfiles.slice(0, 6);
    const lockedCards = completed
      ? ''
      : `${lockedCardHtml('隐藏人格', '还有更多人格等你发掘。')}${lockedCardHtml('待解锁人格', '完成测试后解锁完整 26 种人格。')}`;



    homeCatalog.innerHTML = previewProfiles.map((profile) => fullCardHtml(profile)).join('') + lockedCards;
  }

  if (topbarAvatarWall) {
    topbarAvatarWall.innerHTML = topbarAvatarWallHtml(allProfiles);
  }


  if (homeQuestionCount) homeQuestionCount.textContent = String(questions.length);

  if (homeProfileCount) homeProfileCount.textContent = String(allProfiles.length);
};


renderHome();
