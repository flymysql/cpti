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
} = window.CPTI_DATA;


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

const STAGE_COPY = {
  '探索期': {
    title: '关卡 01｜雷达刚开机',
    intro: '像新手村：先感受第一眼吸引力，也看看你会怎么放出信号。',
    completion: '恭喜通关「探索期」——暧昧副本已解锁，继续点选你的真实反应就好~',
  },
  '心动期': {
    title: '关卡 02｜心动条在涨',
    intro: '试探和上头并行，像 combo 连击：关系开始往前推。',
    completion: '心动值明显飙升！下一关会更考验「你敢不敢把喜欢说清楚」。',
  },
  '甜蜜期': {
    title: '关卡 03｜热恋滤镜 ON',
    intro: '表白、约会、热恋化学反应——选最像你的那一招。',
    completion: '高糖阶段存档完毕～滤镜会慢慢变薄，真实相处副本要开场啦。',
  },
  '磨合期': {
    title: '关卡 04｜日常里见真章',
    intro: '距离、误会、情绪温差都会出现：你怎么拆招？',
    completion: '磨合关通过！你们已经更像「能一起修 bug 的队友」了。',
  },
  '稳定期': {
    title: '关卡 05｜长线运营',
    intro: '价值观、表达方式、分工——把喜欢过成日常的隐藏题。',
    completion: '稳定羁绊 +1。再往前，会碰到底线与选择的硬题哦。',
  },
  '冲突期': {
    title: '关卡 06｜情绪 Boss 战',
    intro: '冲突像放大器：沟通习惯、底线、谁先低头，一次看清。',
    completion: '最难的波次快结束了——下一章看你如何体面收尾或翻盘。',
  },
  '结束期': {
    title: '关卡 07｜终幕演出',
    intro: '故事收尾时，你怎么对自己、也对 Ta 交代？',
    completion: '全剧情通关！去生成你的「恋爱角色卡」吧——记得长按保存分享图。',
  },
};

const MILESTONE_TOASTS = {
  25: {
    kicker: '进度 Buff',
    title: '已完成约 25%',
    copy: '牌组暖机完毕～后段会有几次关键抉择，选最真实的你就对了。',
  },
  50: {
    kicker: '中场结算',
    title: '过半啦！',
    copy: '像打完上半场：喝口水，继续把直觉交给下一组题目。',
  },
  75: {
    kicker: 'Boss 门前',
    title: '约 75% 啦',
    copy: '最后一段最考验本能反应；坚持一下，你的「命中感」会更准。',
  },
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
  if (question.kind === 'scale4') return '单选题';
  if (question.kind === 'multi') return `多选题 · ${question.options.length}项`;
  if (question.kind === 'chat') return `聊天题 · ${question.options.length}选1`;
  if (question.kind === 'rank') return `排序题 · ${question.options.length}项`;
  if (question.kind === 'wild') return `恶搞题 · ${question.options.length}选1`;
  return '单选题';
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
          <strong>你的排序</strong>
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
              <span class='rank-action'>点此撤回</span>
            </button>
          `).join('')}
          ${order.length < question.options.length ? `
            <div class='rank-slot'>
              <span class='rank-pill'>#${order.length + 1}</span>
              <span class='rank-empty'>等待选择</span>
            </div>
          ` : ''}
        </div>
      </div>
      <div class='rank-panel'>
        <div class='rank-panel-head'>
          <strong>待排序</strong>
          <span>按重要性依次点选</span>
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
          `).join('') || `<div class='rank-finished'>已完成排序，如需调整可点上方已选项撤回。</div>`}
        </div>
      </div>
    </div>
  `;
};

const cardHtml = (question, index) => {
  const selectedValue = state.answers[question.id];
  const selectedSet = question.kind === 'multi'
    ? new Set(normalizeMultiAnswer(question, selectedValue))
    : null;
  const kindText = getKindLabel(question);
  const multiTip = question.kind === 'multi'
    ? `<span class='question-multi-tip'>可多选</span>`
    : '';
  const multiHint = question.kind === 'multi'
    ? `<p class='question-multi-hint'>这题可多选，点击多个选项即可</p>`
    : '';
  const answerHtml = question.kind === 'rank'
    ? rankHtml(question)
    : `
      <div class='option-cluster'>
        ${question.options
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
      <div class='question-category'>${question.category}</div>
      <h3>${question.prompt}</h3>
      <p class='question-hint'>${question.hint}</p>
      ${multiHint}
      ${question.kind === 'chat' ? dialogueHtml(question.dialogue) : ''}
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

const stageAvatarHtml = (profile, className = 'stage-toast-avatar') => `
  <div class='avatar-shell small ${className}' style='--avatar-accent:${profile.accent}; --avatar-soft:${profile.soft};'>
    <img src='${profile.avatarImage}' alt='' loading='lazy' decoding='async' />
  </div>
`;

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

const getStageCopy = (category) => STAGE_COPY[category] || {
  title: category,
  intro: '正在推进这一阶段的答题体验。',
  completion: `你已经完成「${category}」，继续进入下一阶段吧。`,
};

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
  stageFloatingStage.textContent = allDone ? '全部完成' : currentCopy.title;
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

  showStageToastMessage({
    kicker: nextStage ? '关卡推进' : '全关卡通关',
    title: nextStage ? `进入「${nextStage.category}」` : '全部关系阶段已通关',
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
  const payload = MILESTONE_TOASTS[pct];
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
  const missingSuffix = missingNumbers.length ? `（未做：${missingNumbers.join('、')}）` : '';

  if (remaining > 0 && !hasGender) {
    submitLabel.textContent = `还差 ${remaining} 题，且需选择性别${missingSuffix}`;
    submitButton.textContent = '先做完题并选择性别';
  } else if (remaining > 0) {
    submitLabel.textContent = `还差 ${remaining} 题${missingSuffix}`;
    submitButton.textContent = '先做完全部题目';
  } else if (!hasGender) {
    submitLabel.textContent = '请选择性别后生成结果';
    submitButton.textContent = '请选择性别';
  } else {
    submitLabel.textContent = '已完成，可生成结果';
    submitButton.textContent = '生成结果并跳转';
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
    .map((option) => `<option value='${option}'>${option || '点击选择（非必选）'}</option>`)
    .join('');
  zodiacSelect.value = state.zodiac;
  syncSelectPlaceholder(zodiacSelect);
};

const populateGender = () => {
  genderSelect.innerHTML = genderOptions
    .map((option) => `<option value='${option}'>${genderLabels[option]}</option>`)
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
});

stageToastClose?.addEventListener('click', () => {
  hideStageToast();
});

restartButton.addEventListener('click', () => {

  const confirmed = window.confirm('确认清空当前测试进度并重新开始吗？这会删除你已选择的答案、性别和星座。');
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
  window.location.href = qs ? `./result.html?${qs}` : './result.html';
});

populateZodiac();
populateGender();
renderStageToastCast();
renderFloatingProgressCast();
renderQuestions();
updateSummary();
syncStageJourney();



