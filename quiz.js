const {
  STORAGE,
  questions,
  zodiacOptions,
  genderOptions,
  genderLabels,
  countAnswered,
  calculateResults,
  buildResultQueryString,
  profiles,
  resolveRasterAvatarThumbUrl,
} = window.CPTI_DATA;

const I18N = window.CPTI_I18N;
const L = (path) => I18N.t(path);

const quizMasonry = document.querySelector('#quiz-masonry');
const submitButton = document.querySelector('#submit-button');
const submitLabel = document.querySelector('#submit-label');
const submitBar = document.querySelector('.submit-bar');
const zodiacSelect = document.querySelector('#zodiac-select');
const genderSelect = document.querySelector('#gender-select');
const restartButton = document.querySelector('#restart-all');
const stageFloatingProgress = document.querySelector('#stage-floating-progress');
const stageFloatingStage = document.querySelector('#stage-floating-stage');
const stageProgressFill = document.querySelector('#stage-progress-fill');
const stageFloatingCounter = document.querySelector('#stage-floating-counter');
const stageFloatingCast = document.querySelector('#stage-floating-cast');
const stageToast = document.querySelector('#stage-toast');
const stageToastClose = document.querySelector('#stage-toast-close');
const stageToastCast = document.querySelector('#stage-toast-cast');

const stageToastKicker = document.querySelector('#stage-toast-kicker');

const stageToastTitle = document.querySelector('#stage-toast-title');
const stageToastCopy = document.querySelector('#stage-toast-copy');


let isSubmitBarVisible = false;
let stageToastTimer = null;
let stageProgressTimer = null;
let milestonePulseTimer = null;



const initialState = {
  answers: {},
  zodiac: '',
  gender: '',
};

const milestoneAnnounced = new Set();

const QUIZ_TOAST_MIN_ANSWER_GAP = 4;
let lastQuizToastAtAnswered = -Infinity;
const pendingStageTransitionIndices = [];

const getAnsweredCountForToasts = () => countAnswered(state.answers);

const canShowQuizToastNow = () => getAnsweredCountForToasts() - lastQuizToastAtAnswered >= QUIZ_TOAST_MIN_ANSWER_GAP;

const markQuizToastShown = () => {
  lastQuizToastAtAnswered = getAnsweredCountForToasts();
};

const enqueueStageTransition = (completedStageIndex) => {
  const queue = pendingStageTransitionIndices;
  if (queue.length && queue[queue.length - 1] === completedStageIndex) return;
  queue.push(completedStageIndex);
};

const tryFlushQuizToasts = () => {
  if (pendingStageTransitionIndices.length) {
    if (!canShowQuizToastNow()) return;
    const idx = pendingStageTransitionIndices.shift();
    markQuizToastShown();
    showStageTransition(idx);
    return;
  }
  tryAnnounceMilestoneNow();
};

const restoreMilestoneFlags = (answers = {}) => {
  const answered = countAnswered(answers);
  const total = questions.length;
  if (!total) return;
  const ratio = answered / total;
  [25, 50, 75].forEach((pct) => {
    if (ratio >= pct / 100 - 0.0001) milestoneAnnounced.add(pct);
  });
};

const stageGroups = questions.reduce((groups, question, index) => {
  const lastGroup = groups[groups.length - 1];
  if (!lastGroup || lastGroup.category !== question.category) {
    groups.push({
      category: question.category,
      startIndex: index,
      endIndex: index,
      questionIds: [question.id],
    });
  } else {
    lastGroup.endIndex = index;
    lastGroup.questionIds.push(question.id);
  }
  return groups;
}, []).map((group, index) => ({
  ...group,
  total: group.questionIds.length,
  order: index + 1,
}));


const getKindLabel = (question) => {
  const call = (key, ...args) => {
    const v = I18N.t(key);
    return typeof v === 'function' ? v(...args) : v;
  };
  if (question.kind === 'scale4') return call('quiz.kindScale4');
  if (question.kind === 'multi') return call('quiz.kindMulti', question.options.length);
  if (question.kind === 'chat') return call('quiz.kindChat', question.options.length);
  if (question.kind === 'rank') return call('quiz.kindRank', question.options.length);
  if (question.kind === 'wild') return call('quiz.kindWild', question.options.length);
  return call('quiz.kindScale4');
};

const findQuestion = (questionId) => questions.find((question) => question.id === questionId);

const normalizeRankAnswer = (question, answer) => {
  if (!question || !Array.isArray(answer)) return [];
  const seen = new Set();
  return answer.filter((optionIndex) => {
    if (!Number.isInteger(optionIndex)) return false;
    if (optionIndex < 0 || optionIndex >= question.options.length) return false;
    if (seen.has(optionIndex)) return false;
    seen.add(optionIndex);
    return true;
  });
};

const normalizeMultiAnswer = (question, answer) => {
  if (!question || !Array.isArray(answer)) return [];
  const seen = new Set();
  return answer.filter((optionIndex) => {
    if (!Number.isInteger(optionIndex)) return false;
    if (optionIndex < 0 || optionIndex >= question.options.length) return false;
    if (seen.has(optionIndex)) return false;
    seen.add(optionIndex);
    return true;
  });
};

const loadProgress = () => {
  try {
    const raw = localStorage.getItem(STORAGE.progressKey);
    if (!raw) return { ...initialState };
    const parsed = JSON.parse(raw);
    return {
      answers: parsed.answers || {},
      zodiac: parsed.zodiac || parsed.mbti || '',
      gender: parsed.gender || '',
    };
  } catch (error) {
    return { ...initialState };
  }
};

const state = loadProgress();
restoreMilestoneFlags(state.answers);

const isQuestionAnswered = (question, answers = {}) => {
  if (question.kind === 'rank') return normalizeRankAnswer(question, answers[question.id]).length === question.options.length;
  if (question.kind === 'multi') return normalizeMultiAnswer(question, answers[question.id]).length > 0;
  return Number.isInteger(answers[question.id]);
};

const getUnansweredQuestionNumbers = () => questions
  .map((question, index) => ({ question, index }))
  .filter(({ question }) => !isQuestionAnswered(question, state.answers))
  .map(({ index }) => `Q${index + 1}`);

const saveProgress = () => {
  localStorage.setItem(
    STORAGE.progressKey,
    JSON.stringify({ answers: state.answers, zodiac: state.zodiac, gender: state.gender })
  );
};


const clearAll = () => {
  state.answers = {};
  state.zodiac = '';
  state.gender = '';
  localStorage.removeItem(STORAGE.progressKey);
  localStorage.removeItem(STORAGE.resultKey);
  milestoneAnnounced.clear();
  pendingStageTransitionIndices.length = 0;
  lastQuizToastAtAnswered = -Infinity;
};

const optionHtml = (questionId, option, index, isSelected) => `
  <button
    class='option-button ${isSelected ? 'is-selected' : ''}'
    type='button'
    data-question-id='${questionId}'
    data-option-index='${index}'
  >
    ${option.label}
  </button>
`;

const dialogueHtml = (dialogue = []) => {
  if (!dialogue.length) return '';
  return `
    <div class='chat-shot'>
      ${dialogue
        .map((item) => {
          const role = item.role === 'me' ? 'me' : 'them';
          return `
            <div class='chat-row ${role}'>
              ${role === 'them' ? `<span class='chat-avatar' aria-hidden='true'></span>` : ''}
              <div class='bubble ${role}'>${item.text}</div>
            </div>

          `;
        })
        .join('')}
    </div>
  `;
};

const rankHtml = (question) => {
  const order = normalizeRankAnswer(question, state.answers[question.id]);
  const picked = new Set(order);
  const remaining = question.options
    .map((option, index) => ({ option, index }))
    .filter(({ index }) => !picked.has(index));

  return `
    <div class='rank-builder'>
      <div class='rank-panel'>
        <div class='rank-panel-head'>
          <strong>${L('quiz.rankYourOrder')}</strong>
          <span>${order.length}/${question.options.length}</span>
        </div>
        <div class='rank-list'>
          ${order.map((optionIndex, position) => `
            <button
              class='rank-picked-button'
              type='button'
              data-rank-remove='true'
              data-question-id='${question.id}'
              data-option-index='${optionIndex}'
            >
              <span class='rank-pill'>#${position + 1}</span>
              <span class='rank-label'>${question.options[optionIndex].label}</span>
              <span class='rank-action'>${L('quiz.rankTapUndo')}</span>
            </button>
          `).join('')}
          ${order.length < question.options.length ? `
            <div class='rank-slot'>
              <span class='rank-pill'>#${order.length + 1}</span>
              <span class='rank-empty'>${L('quiz.rankWaitingPick')}</span>
            </div>
          ` : ''}
        </div>
      </div>
      <div class='rank-panel'>
        <div class='rank-panel-head'>
          <strong>${L('quiz.rankRemaining')}</strong>
          <span>${L('quiz.rankBankHint')}</span>
        </div>
        <div class='option-cluster rank-bank'>
          ${remaining.map(({ option, index }) => `
            <button
              class='option-button rank-choice-button'
              type='button'
              data-rank-pick='true'
              data-question-id='${question.id}'
              data-option-index='${index}'
            >
              ${option.label}
            </button>
          `).join('') || `<div class='rank-finished'>${L('quiz.rankFinished')}</div>`}
        </div>
      </div>
    </div>
  `;
};

const cardHtml = (question, index) => {
  const qd = I18N.mergeQuestionToDisplay(question);
  const selectedValue = state.answers[question.id];
  const selectedSet = question.kind === 'multi'
    ? new Set(normalizeMultiAnswer(question, selectedValue))
    : null;
  const kindText = getKindLabel(question);
  const multiTip = question.kind === 'multi'
    ? `<span class='question-multi-tip'>${L('quiz.multiTip')}</span>`
    : '';
  const multiHint = question.kind === 'multi'
    ? `<p class='question-multi-hint'>${L('quiz.multiHint')}</p>`
    : '';
  const answerHtml = question.kind === 'rank'
    ? rankHtml(qd)
    : `
      <div class='option-cluster'>
        ${qd.options
          .map((option, optionIndex) => optionHtml(
            question.id,
            option,
            optionIndex,
            selectedSet ? selectedSet.has(optionIndex) : selectedValue === optionIndex
          ))
          .join('')}
      </div>
    `;

  return `
    <article class='question-card ${question.kind === 'wild' ? 'is-wild' : ''}'>
      <div class='question-head'>
        <span class='question-number'>Q${index + 1}</span>
        <div class='question-badges'>
          <span class='question-kind'>${kindText}</span>
          ${multiTip}
        </div>
      </div>
      <div class='question-category'>${qd.category}</div>
      <h3>${qd.prompt}</h3>
      <p class='question-hint'>${qd.hint}</p>
      ${multiHint}
      ${question.kind === 'chat' ? dialogueHtml(qd.dialogue) : ''}
      ${answerHtml}
    </article>
  `;
};

const renderQuestions = () => {
  quizMasonry.innerHTML = questions.map((question, index) => cardHtml(question, index)).join('');
};

const stageCharacterProfiles = [
  { profile: profiles.badboy, positionClass: 'is-left' },
  { profile: profiles.solo, positionClass: 'is-right' },
].filter(({ profile }) => profile);

const stageAvatarHtml = (profile, className = 'stage-toast-avatar') => {
  const src = resolveRasterAvatarThumbUrl(profile.id, {
    quizCompleted: Boolean(state.gender),
    userGender: state.gender || '',
  });
  return `
  <div class='avatar-shell small ${className}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src='${src}' alt='' loading='lazy' decoding='async' />
  </div>
`;
};

const renderStageCharacters = (target, avatarClassName, wrapClassName) => {
  if (!target) return;
  if (!stageCharacterProfiles.length) {
    target.hidden = true;
    target.innerHTML = '';
    return;
  }

  target.hidden = false;
  target.innerHTML = stageCharacterProfiles
    .map(({ profile, positionClass }) => `
      <div class='${wrapClassName} ${positionClass}'>
        <div class='stage-toast-character-bob'>
          ${stageAvatarHtml(profile, avatarClassName)}
        </div>
      </div>
    `)
    .join("<span class='stage-toast-heart' aria-hidden='true'>♥</span>");
};

const renderStageToastCast = () => {
  renderStageCharacters(stageToastCast, 'stage-toast-avatar', 'stage-toast-character');
};

const renderFloatingProgressCast = () => {
  renderStageCharacters(stageFloatingCast, 'stage-floating-avatar', 'stage-floating-character');
};

const refreshStageAvatarCasts = () => {
  renderStageToastCast();
  renderFloatingProgressCast();
};

const getStageCopy = (category) => I18N.getStageBlock(category);

const getStageAnsweredCount = (stage, answers = {}) => stage.questionIds
  .map((questionId) => findQuestion(questionId))
  .filter(Boolean)
  .filter((question) => isQuestionAnswered(question, answers))
  .length;

const getCompletedStageIndex = (answers = {}) => {
  let completedIndex = -1;
  for (let index = 0; index < stageGroups.length; index += 1) {
    const stage = stageGroups[index];
    if (getStageAnsweredCount(stage, answers) !== stage.total) break;
    completedIndex = index;
  }
  return completedIndex;
};

const getCurrentStageIndex = (answers = {}) => {
  const nextStage = stageGroups.findIndex((stage) => getStageAnsweredCount(stage, answers) < stage.total);
  return nextStage === -1 ? Math.max(stageGroups.length - 1, 0) : nextStage;
};

const renderStageJourney = () => {
  if (!stageFloatingProgress || !stageFloatingStage || !stageProgressFill || !stageFloatingCounter) return;

  const answered = countAnswered(state.answers);
  const total = questions.length;
  const currentStageIndex = getCurrentStageIndex(state.answers);
  const currentStage = stageGroups[currentStageIndex];
  if (!currentStage) return;

  const allDone = answered === total;
  const currentCopy = getStageCopy(currentStage.category);
  const progressPercent = total ? (answered / total) * 100 : 0;
  const widthPercent = stageCharacterProfiles.length
    ? Math.max(progressPercent, 18)
    : progressPercent;

  stageFloatingProgress.classList.toggle('is-all-done', allDone);
  stageFloatingStage.textContent = allDone ? L('quiz.stageFloatingAllDone') : currentCopy.title;
  stageFloatingCounter.textContent = `${answered} / ${total}`;
  stageProgressFill.style.width = `${Math.min(widthPercent, 100)}%`;
  stageFloatingProgress.dataset.currentStage = currentStage.category;
};

const hideStageToast = () => {
  if (!stageToast) return;
  if (stageToastTimer) {
    window.clearTimeout(stageToastTimer);
    stageToastTimer = null;
  }
  stageToast.classList.remove('is-visible', 'is-micro');
  stageToast.hidden = true;
  if (stageToastCast) {
    stageToastCast.hidden = false;
  }
};

const pulseStageProgress = () => {
  if (!stageFloatingProgress) return;
  if (stageProgressTimer) window.clearTimeout(stageProgressTimer);
  stageFloatingProgress.classList.remove('is-celebrating');
  void stageFloatingProgress.offsetWidth;
  stageFloatingProgress.classList.add('is-celebrating');
  stageProgressTimer = window.setTimeout(() => {
    stageFloatingProgress.classList.remove('is-celebrating');
  }, 900);
};

const pulseMilestoneProgress = () => {
  if (!stageFloatingProgress) return;
  if (milestonePulseTimer) window.clearTimeout(milestonePulseTimer);
  stageFloatingProgress.classList.remove('is-milestone-pulse');
  void stageFloatingProgress.offsetWidth;
  stageFloatingProgress.classList.add('is-milestone-pulse');
  milestonePulseTimer = window.setTimeout(() => {
    stageFloatingProgress.classList.remove('is-milestone-pulse');
  }, 900);
};

const showStageToastMessage = ({
  kicker,
  title,
  copy,
  duration = 5600,
  micro = false,
} = {}) => {
  if (!stageToast) return;
  stageToastKicker.textContent = kicker;
  stageToastTitle.textContent = title;
  stageToastCopy.textContent = copy;
  stageToast.classList.toggle('is-micro', micro);
  if (stageToastCast) {
    stageToastCast.hidden = micro;
  }

  if (stageToastTimer) window.clearTimeout(stageToastTimer);
  stageToast.hidden = false;
  stageToast.classList.remove('is-visible');
  void stageToast.offsetWidth;
  stageToast.classList.add('is-visible');

  if (micro) {
    pulseMilestoneProgress();
  } else {
    pulseStageProgress();
  }

  stageToastTimer = window.setTimeout(() => {
    hideStageToast();
  }, duration);
};

const showStageTransition = (completedStageIndex) => {
  const completedStage = stageGroups[completedStageIndex];
  const nextStage = stageGroups[completedStageIndex + 1];
  const completedCopy = getStageCopy(completedStage?.category || '');
  const nextCat = nextStage
    ? I18N.mergeQuestionToDisplay(findQuestion(nextStage.questionIds[0])).category
    : '';

  showStageToastMessage({
    kicker: nextStage ? L('quiz.stageAdvanceKicker') : L('quiz.stageAllDoneKicker'),
    title: nextStage ? (typeof L('quiz.stageEnterTpl') === 'function' ? L('quiz.stageEnterTpl')(nextCat || nextStage.category) : nextCat) : L('quiz.stageAllStagesDone'),
    copy: completedCopy.completion,
    duration: 6200,
    micro: false,
  });
};

const tryAnnounceMilestoneNow = () => {
  const answered = countAnswered(state.answers);
  const total = questions.length;
  if (!total || answered === 0) return;
  if (!canShowQuizToastNow()) return;
  const ratio = answered / total;
  const pct = [25, 50, 75].find((p) => ratio >= p / 100 && !milestoneAnnounced.has(p));
  if (pct == null) return;
  const payload = I18N.getMilestoneBlock(pct);
  if (!payload) return;
  milestoneAnnounced.add(pct);
  markQuizToastShown();
  showStageToastMessage({
    ...payload,
    duration: 3800,
    micro: true,
  });
};

const syncStageJourney = ({ previousCompletedStageIndex = getCompletedStageIndex(state.answers), triggeredByAnswer = false } = {}) => {
  const nextCompletedStageIndex = getCompletedStageIndex(state.answers);
  renderStageJourney();
  if (triggeredByAnswer && nextCompletedStageIndex > previousCompletedStageIndex) {
    enqueueStageTransition(nextCompletedStageIndex);
  }
};


const applyAnswerChange = (updater) => {
  const previousCompletedStageIndex = getCompletedStageIndex(state.answers);
  updater();
  saveProgress();
  renderQuestions();
  updateSummary();
  syncStageJourney({ previousCompletedStageIndex, triggeredByAnswer: true });
  tryFlushQuizToasts();
};

const syncSelectPlaceholder = (select) => {
  select.classList.toggle('is-placeholder', !select.value);
};


const updateSummary = () => {
  const answered = countAnswered(state.answers);
  const total = questions.length;
  const remaining = total - answered;
  const hasGender = Boolean(state.gender);
  const missingNumbers = isSubmitBarVisible && remaining > 0 && remaining < 3
    ? getUnansweredQuestionNumbers()
    : [];
  const missingSuffix = missingNumbers.length ? L('quiz.summaryMissingTpl')(missingNumbers) : '';

  if (remaining > 0 && !hasGender) {
    submitLabel.textContent = `${L('quiz.summaryRemainGenderTpl')(remaining)}${missingSuffix}`;
    submitButton.textContent = L('quiz.submitNeedQuestions');
  } else if (remaining > 0) {
    submitLabel.textContent = `${L('quiz.summaryRemainTpl')(remaining)}${missingSuffix}`;
    submitButton.textContent = L('quiz.submitDoQuestions');
  } else if (!hasGender) {
    submitLabel.textContent = L('quiz.summaryNeedGenderLabel');
    submitButton.textContent = L('quiz.submitPickGender');
  } else {
    submitLabel.textContent = L('quiz.summaryReadyLabel');
    submitButton.textContent = L('quiz.submitGenerate');
  }

  submitButton.disabled = remaining !== 0 || !hasGender;
};

if (submitBar && 'IntersectionObserver' in window) {
  const submitObserver = new IntersectionObserver((entries) => {
    const nextVisible = entries.some((entry) => entry.isIntersecting);
    if (nextVisible !== isSubmitBarVisible) {
      isSubmitBarVisible = nextVisible;
      updateSummary();
    }
  }, { threshold: 0.6 });
  submitObserver.observe(submitBar);
} else {
  isSubmitBarVisible = true;
}

const populateZodiac = () => {

  zodiacSelect.innerHTML = zodiacOptions
    .map((option, index) => `<option value='${option}'>${I18N.getZodiacOptionLabel(option, index)}</option>`)
    .join('');
  zodiacSelect.value = state.zodiac;
  syncSelectPlaceholder(zodiacSelect);
};

const populateGender = () => {
  const labels = I18N.getGenderLabelMap() || genderLabels;
  genderSelect.innerHTML = genderOptions
    .map((option) => `<option value='${option}'>${labels[option]}</option>`)
    .join('');
  genderSelect.value = state.gender;
  syncSelectPlaceholder(genderSelect);
};

quizMasonry.addEventListener('click', (event) => {
  const button = event.target.closest('[data-question-id]');
  if (!button) return;

  const questionId = button.getAttribute('data-question-id');
  const optionIndex = Number(button.getAttribute('data-option-index'));
  const question = findQuestion(questionId);
  if (!question) return;

  if (button.hasAttribute('data-rank-pick')) {
    applyAnswerChange(() => {
      const current = normalizeRankAnswer(question, state.answers[questionId]);
      if (!current.includes(optionIndex)) current.push(optionIndex);
      state.answers[questionId] = current;
    });
    return;
  }

  if (button.hasAttribute('data-rank-remove')) {
    applyAnswerChange(() => {
      const next = normalizeRankAnswer(question, state.answers[questionId]).filter((index) => index !== optionIndex);
      if (next.length) {
        state.answers[questionId] = next;
      } else {
        delete state.answers[questionId];
      }
    });
    return;
  }

  if (question.kind === 'multi') {
    applyAnswerChange(() => {
      const current = normalizeMultiAnswer(question, state.answers[questionId]);
      const next = current.includes(optionIndex)
        ? current.filter((index) => index !== optionIndex)
        : [...current, optionIndex];
      if (next.length) {
        state.answers[questionId] = next;
      } else {
        delete state.answers[questionId];
      }
    });
    return;
  }

  applyAnswerChange(() => {
    state.answers[questionId] = optionIndex;
  });
});


zodiacSelect.addEventListener('change', () => {
  state.zodiac = zodiacSelect.value;
  syncSelectPlaceholder(zodiacSelect);
  saveProgress();
  updateSummary();
});

genderSelect.addEventListener('change', () => {
  state.gender = genderSelect.value;
  syncSelectPlaceholder(genderSelect);
  saveProgress();
  updateSummary();
  refreshStageAvatarCasts();
});

stageToastClose?.addEventListener('click', () => {
  hideStageToast();
});

restartButton.addEventListener('click', () => {

  const confirmed = window.confirm(L('quiz.restartConfirm'));
  if (!confirmed) return;

  clearAll();
  hideStageToast();
  populateZodiac();
  populateGender();
  renderQuestions();
  updateSummary();
  syncStageJourney();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});



submitButton.addEventListener('click', () => {
  const answered = countAnswered(state.answers);
  if (answered !== questions.length) return;
  if (!state.gender) {
    updateSummary();
    genderSelect.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const result = calculateResults({ answers: state.answers, zodiac: state.zodiac, gender: state.gender });

  const payload = {
    answers: state.answers,
    zodiac: state.zodiac,
    gender: state.gender,
    completedAt: new Date().toISOString(),
    answeredCount: answered,
    result,
  };

  localStorage.setItem(STORAGE.resultKey, JSON.stringify(payload));
  localStorage.setItem(STORAGE.progressKey, JSON.stringify({ answers: state.answers, zodiac: state.zodiac, gender: state.gender }));
  const qs = buildResultQueryString(result);
  const params = new URLSearchParams(qs || '');
  if (I18N.getLocale() === 'en') params.set('lang', 'en');
  else params.delete('lang');
  const tail = params.toString();
  window.location.href = tail ? `./result.html?${tail}` : './result.html';
});

const applyQuizChrome = () => {
  document.title = L('quiz.docTitle');
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', L('quiz.metaDesc'));
  document.querySelector('.brand')?.setAttribute('aria-label', L('quiz.brandAria'));
  document.querySelector('.brand')?.setAttribute('href', I18N.withLang('./index.html'));
  document.querySelector('.topbar-actions')?.setAttribute('aria-label', L('common.topbarNavAria'));
  const h1 = document.querySelector('.quiz-heading h1');
  if (h1) h1.textContent = L('quiz.h1');
  const lead = document.querySelector('.quiz-heading p');
  if (lead) lead.textContent = L('quiz.sub');
  const cards = document.querySelectorAll('.quiz-toolbar .mbti-card');
  if (cards[0]) {
    const sl = cards[0].querySelector('.small-label');
    const st = cards[0].querySelector('.mbti-label strong');
    const hp = cards[0].querySelector('p');
    if (sl) sl.textContent = L('quiz.genderEyebrow');
    if (st) st.textContent = L('quiz.genderLabel');
    if (hp) hp.textContent = L('quiz.genderHelp');
  }
  if (cards[1]) {
    const sl = cards[1].querySelector('.small-label');
    const st = cards[1].querySelector('.mbti-label strong');
    const hp = cards[1].querySelector('p');
    if (sl) sl.textContent = L('quiz.zodiacEyebrow');
    if (st) st.textContent = L('quiz.zodiacLabel');
    if (hp) hp.textContent = L('quiz.zodiacHelp');
  }
  document.querySelectorAll('.topbar-actions .topbar-link').forEach((el) => {
    const href = el.getAttribute('href') || '';
    if (href.includes('index.html')) {
      el.textContent = L('common.home');
      el.setAttribute('href', I18N.withLang('./index.html'));
    }
    if (href.includes('result.html')) {
      el.textContent = L('common.result');
      el.setAttribute('href', I18N.withLang('./result.html'));
    }
  });
  if (restartButton) restartButton.textContent = L('quiz.restart');
  const subHint = document.querySelector('.submit-bar small');
  if (subHint) subHint.textContent = L('quiz.submitHint');
  if (submitLabel) submitLabel.textContent = L('quiz.submitLoading');
  if (submitButton) submitButton.textContent = L('quiz.submitIdle');
  stageFloatingProgress?.setAttribute('aria-label', L('quiz.stageAria'));
  stageToastClose?.setAttribute('aria-label', L('quiz.toastCloseAria'));
  if (genderSelect) genderSelect.setAttribute('aria-label', L('quiz.genderAria'));
  if (zodiacSelect) zodiacSelect.setAttribute('aria-label', L('quiz.zodiacAria'));
  const foot = document.querySelector('.footer.container p');
  if (foot) {
    foot.innerHTML = `${L('common.footerDisclaimer')}<br><span class='author-highlight'>${L('common.author')}</span>`;
  }
  document.documentElement.lang = I18N.getLocale() === 'en' ? 'en' : 'zh-CN';
};

applyQuizChrome();
I18N.mountLanguageSwitch();

populateZodiac();
populateGender();
renderStageToastCast();
renderFloatingProgressCast();
renderQuestions();
updateSummary();
syncStageJourney();



