const {
  profiles,
  getProfileRarityLabel,
  getProfileRarityRating,
  getProfileEaseRating,
} = window.CPTI_DATA;
const profileDetails = window.CPTI_PROFILE_DETAILS || {};

const profileEmpty = document.querySelector('#profile-empty');
const profileView = document.querySelector('#profile-view');

const sourceConfig = {
  home: {
    label: '来自首页人格图鉴',
    backHref: './index.html',
    backText: '返回首页',
  },
  result: {
    label: '来自结果页完整图鉴',
    backHref: './result.html',
    backText: '返回结果页',
  },
  self: {
    label: '你的测试结果人格',
    backHref: './result.html',
    backText: '返回结果页',
  },
  need: {
    label: '最和你匹配的类型',
    backHref: './result.html',
    backText: '返回结果页',
  },

};

const avatarHtml = (profile, size = 'large') => `
  <div class='avatar-shell ${size}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src="${profile.avatarImage}" alt="${profile.name} 头像" loading="lazy" />
  </div>
`;

const renderStars = (rating, total = 5) => Array.from({ length: total }, (_, index) => (
  `<span class='detail-star ${index < rating ? 'is-active' : ''}'>★</span>`
)).join('');


const defaultDetail = (profile) => ({
  essay: profile.detailEssay || `${profile.name} 型通常会把自己的恋爱节奏、情绪表达和亲密需求放进很鲜明的相处风格里。你在关系中的表现并不是单一优点或单一短板，而是一整套相处习惯。理解自己的方式，不是为了给自己贴死标签，而是为了更早看见自己在爱里会怎么靠近、怎么退开、怎么表达喜欢，也知道什么样的关系更适合长期停留。`,
  advice: Array.isArray(profile.advice) && profile.advice.length
    ? profile.advice
    : [
      `保留你的「${profile.tags?.[0] || '底色'}」，但别让它代替沟通。`,
      `当「${profile.tags?.[1] || '防御'}」开始过头时，记得把真实需求说出来。`,
      `你更适合能接住你「${profile.tags?.[2] || '节奏'}」这一面的人，而不是只接住表面状态的人。`,
    ],
});

const mergeProfileDetail = (targetProfile) => {
  const fallback = defaultDetail(targetProfile);
  const extra = profileDetails[targetProfile.id];
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
const sourceMeta = sourceConfig[source] || sourceConfig.home;
const profile = profiles[profileId];

const renderNotFound = () => {
  profileEmpty.classList.remove('hidden');
  profileView.classList.add('hidden');
};

const renderProfile = (targetProfile) => {
  const detail = mergeProfileDetail(targetProfile);
  const descriptionMeta = document.querySelector('meta[name="description"]');

  document.title = `CPTI | ${targetProfile.name} 人格详情`;
  const metaBits = [detail.friction, detail.earlySignals, targetProfile.description].filter(Boolean);
  descriptionMeta?.setAttribute(
    'content',
    `${targetProfile.name} 型恋爱人格：${metaBits[0] || targetProfile.description}`,
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
          <h1>${targetProfile.name}</h1>
          <div class='detail-metrics'>
            <div class='detail-metric'>
              <span class='detail-metric-label'>稀有度</span>
              <span class='catalog-flag rarity ${rarityLabel.toLowerCase()}'>${rarityLabel}</span>
              <span class='detail-stars' aria-label='稀有度 ${rarityRating} 星'>${renderStars(rarityRating)}</span>
            </div>
            <div class='detail-metric'>
              <span class='detail-metric-label'>容易被拿下程度</span>
              <span class='detail-stars' aria-label='容易被拿下程度 ${easeRating} 星'>${renderStars(easeRating)}</span>
            </div>
          </div>
          <p class='detail-hero-lead'>${targetProfile.description}</p>
          <p>${targetProfile.longDescription}</p>
          <div class='tag-row compact'>
            ${targetProfile.tags.map((tag) => `<span>${tag}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>


    <div class='detail-grid'>
      <article class='panel-card detail-section'>
        <span class='eyebrow'>恋爱里的表现</span>
        <h2>${targetProfile.name} 型通常会怎样爱</h2>
        <p>${detail.essay}</p>
        <p class='detail-copy'>${targetProfile.note}</p>
      </article>

      <article class='panel-card detail-section'>
        <span class='eyebrow'>更适合你的关系节奏</span>
        <h2>什么样的伴侣最和你匹配</h2>

        <p>${targetProfile.needDescription}</p>
        <p class='detail-copy'>${targetProfile.needLongDescription}</p>
        <p>${targetProfile.needNote}</p>
      </article>
    </div>

    ${detail.friction || detail.earlySignals ? `
    <section class='panel-card detail-section detail-extra-radar'>
      <span class='eyebrow'>相处小雷达</span>
      <h2>这类人格在关系里常见的张力与早期信号</h2>
      ${detail.friction ? `<p>${detail.friction}</p>` : ''}
      ${detail.earlySignals ? `<p class='detail-copy'>${detail.earlySignals}</p>` : ''}
    </section>
    ` : ''}

    <section class='section-block compact-top detail-section-wrap'>
      <div class='section-heading narrow'>
        <h2>给${targetProfile.name}型的三条提醒</h2>

        <p>这些建议不是要你改变个性，而是帮你在保留底色的前提下，把关系过得更稳、更舒服。</p>
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
        <span class='eyebrow'>继续探索</span>
        <h2>换一种角度再看你的关系模式</h2>
        <p>你可以回到测试页重新作答，也可以回到结果页看看自己最后命中的人格组合。</p>
      </div>
      <div class='detail-cta-actions'>
        <a class='primary-button' href='./quiz.html'>重新测试</a>
        <a class='secondary-button' href='./result.html'>查看结果页</a>
      </div>
    </section>
  `;
};


if (!profile) {
  renderNotFound();
} else {
  renderProfile(profile);
}
