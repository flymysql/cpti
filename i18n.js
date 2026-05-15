(() => {
  const STORAGE_KEY = 'cpti_locale';
  const SUPPORTED = new Set(['zh', 'en']);

  const normalizeLocale = (raw) => {
    const v = String(raw || '').toLowerCase().trim();
    if (v === 'en' || v.startsWith('en-')) return 'en';
    return 'zh';
  };

  const readUrlLocale = () => {
    try {
      const p = new URLSearchParams(window.location.search);
      const fromQuery = p.get('lang') || p.get('locale');
      if (fromQuery) return normalizeLocale(fromQuery);
    } catch {
      /* ignore */
    }
    return null;
  };

  const getLocale = () => {
    const fromUrl = readUrlLocale();
    if (fromUrl) return fromUrl;
    try {
      const stored = normalizeLocale(localStorage.getItem(STORAGE_KEY));
      if (stored === 'en') return 'en';
    } catch {
      /* ignore */
    }
    try {
      return normalizeLocale(navigator.language);
    } catch {
      return 'zh';
    }
  };

  let activeLocale = getLocale();

  const setLocale = (next, { reload = true } = {}) => {
    const normalized = normalizeLocale(next);
    activeLocale = normalized;
    try {
      localStorage.setItem(STORAGE_KEY, activeLocale);
    } catch {
      /* ignore */
    }
    if (!reload) return;
    try {
      const u = new URL(window.location.href);
      if (normalized === 'zh') {
        u.searchParams.delete('lang');
        u.searchParams.delete('locale');
      } else {
        u.searchParams.set('lang', normalized);
      }
      window.location.assign(`${u.pathname}${u.search}${u.hash}`);
    } catch {
      window.location.reload();
    }
  };

  const initFromUrl = () => {
    const fromUrl = readUrlLocale();
    if (fromUrl) {
      activeLocale = fromUrl;
      try {
        localStorage.setItem(STORAGE_KEY, activeLocale);
      } catch {
        /* ignore */
      }
    } else {
      activeLocale = getLocale();
    }
    return activeLocale;
  };

  const withLang = (href) => {
    const loc = activeLocale;
    if (!href || loc === 'zh') return href;
    try {
      const u = new URL(href, window.location.href);
      u.searchParams.set('lang', loc);
      if (/^https?:/i.test(href)) return u.href;
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      const joiner = href.includes('?') ? '&' : '?';
      return `${href}${joiner}lang=${loc}`;
    }
  };

  const mergeLangIntoSearch = (searchString) => {
    const loc = activeLocale;
    const raw = typeof searchString === 'string' && searchString.startsWith('?')
      ? searchString.slice(1)
      : searchString || '';
    const p = new URLSearchParams(raw);
    if (loc === 'zh') p.delete('lang');
    else p.set('lang', loc);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const STRINGS = {
    zh: {},
    en: {},
  };

  STRINGS.zh.common = {
    brandSmall: '恋爱人格实验室 cpti.cc',
    topbarNavAria: '快捷入口',
    home: '首页',
    quiz: '测试页',
    result: '结果页',
    myResult: '我的结果',
    footerDisclaimer: '© CPTI · 2026  结果仅供内容体验与社交分享，不替代专业的亲密关系评估。',
    authorHtml: '<a href="https://gitpull.cn" target="_blank" rel="noopener noreferrer">作者：兰州小红鸡</a>',
    langZh: '中文',
    langEn: 'English',
    langSwitch: '语言',
  };

  STRINGS.en.common = {
    brandSmall: 'Love personality lab · cpti.cc',
    topbarNavAria: 'Quick links',
    home: 'Home',
    quiz: 'Quiz',
    result: 'Results',
    myResult: 'My results',
    footerDisclaimer: '© CPTI · 2026 · For fun and sharing only — not a substitute for professional relationship support.',
    authorHtml: '<a href="https://gitpull.cn" target="_blank" rel="noopener noreferrer">By Lanzhou Little Red Chicken</a>',
    langZh: '中文',
    langEn: 'English',
    langSwitch: 'Language',
  };

  STRINGS.zh.index = {
    docTitle: 'CPTI | 恋爱人格测试',
    metaDesc: 'CPTI 恋爱人格测试：用同一套人格池测出你在亲密关系里的倾向，以及更可能与你合拍的对象类型。',
    brandAria: 'CPTI 首页',
    heroH1Html: '你在爱里<em>最像谁</em><span class="hero-break">又会被谁吸引</span>',
    heroLead: '这是一份围绕26种恋爱人格的测试。你会通过29道题目，在人格池里得到“你是谁”和“谁更适合你”。',
    heroStart: '开始',
    catalogEyebrow: '恋爱人格预览',
    catalogTitleTpl: (n) => `先认识这${n}种恋爱人格`,
    catalogDesc: '每一种都对应一种更容易被记住的相处气质，你可以先点开卡片看详情，再进去做题看自己最终会落在哪一型。',
    lockedTitleA: '隐藏人格',
    lockedCopyA: '还有更多人格等你发掘。',
    lockedTitleB: '待解锁人格',
    lockedCopyBTpl: (n) => `完成测试后解锁全部 ${n} 种人格。`,
    cardAriaTpl: (name) => `查看 ${name} 人格详情`,
    cardHint: '查看人格详情 →',
    lockedHint: '完成测试即可解锁',
    sectionEyebrow: '它会测什么',
    sectionH2: '从表达方式到情绪处理，帮你看清自己在亲密里的需求',
    sectionP: '测试会根据你的主动性、边界感、依恋倾向和情绪处理方式，生成你的恋爱人格结果。',
    f1h: '你在亲密关系里的人格模式',
    f1p: '你更擅长主动推进、制造情绪价值，还是习惯克制观察、慢慢确认。',
    f2h: '什么样的恋爱人格与你更匹配',
    f2p: '匹配的人格更适合你，和你走的更长久一点。',
    f3h: '完整人格图鉴与详情页',
    f3p: '26种人格都有独立介绍页，包含相处建议与关系里的常见表现。',
    footerHtml: '© CPTI · 2026 恋爱人格测试。结果仅供内容体验与社交分享，不替代专业评估。',
  };

  STRINGS.en.index = {
    docTitle: 'CPTI | Love personality test',
    metaDesc: 'CPTI maps how you show up in intimacy — and which partner styles you tend to click with — using one shared pool of love-personality archetypes.',
    brandAria: 'CPTI home',
    heroH1Html: 'In love, <em>who you resemble</em><span class="hero-break">and who pulls you in</span>',
    heroLead: 'This quiz maps you onto 26 love-personality types. Answer the prompts honestly to see who you resemble — and who tends to fit you best.',
    heroStart: 'Start',
    catalogEyebrow: 'Archetype preview',
    catalogTitleTpl: (n) => `Meet ${n} love personalities`,
    catalogDesc: 'Each card is a recognizable vibe in dating. Browse details first, then take the quiz to see where you land.',
    lockedTitleA: 'Hidden card',
    lockedCopyA: 'More archetypes unlock after you finish the quiz.',
    lockedTitleB: 'Locked roster',
    lockedCopyBTpl: (n) => `Finish the quiz to unlock all ${n} types.`,
    cardAriaTpl: (name) => `Open ${name} profile`,
    cardHint: 'Open profile →',
    lockedHint: 'Finish the quiz to unlock',
    sectionEyebrow: 'What it measures',
    sectionH2: 'From expression to emotional habits in intimacy',
    sectionP: 'The quiz weights initiative, boundaries, attachment flavor, and how you handle feelings — then outputs your best-fit types.',
    f1h: 'Your intimacy style',
    f1p: 'Whether you lead, pace yourself, create sparks, or observe before you commit.',
    f2h: 'Who tends to match you',
    f2p: 'A complementary “need” type summarizes the partner energy that often fits you better long-term.',
    f3h: 'Full roster + detail pages',
    f3p: 'Every archetype has a dedicated page with notes and relationship tips.',
    footerHtml: '© CPTI · 2026 · For fun and sharing only — not a substitute for professional assessment.',
  };

  STRINGS.zh.quiz = {
    docTitle: 'CPTI | 测试页',
    metaDesc: 'CPTI测试页包含基于26个人格原型重写的短题卡、性别必选与星座可选辅助输入，以及独立结果页跳转。',
    brandAria: '返回首页',
    navResult: '结果页',
    restart: '清空重做',
    restartConfirm: '确认清空当前测试进度并重新开始吗？这会删除你已选择的答案、性别和星座。',
    h1: '测出你在关系里“你最像谁”和“谁更适合你”',
    sub: '做题时记得选真实的你，不要选想象中的你。',
    genderEyebrow: '必选项',
    genderLabel: '选择你的性别',
    genderHelp: '性别会轻度修正部分名字本身带性别感的人格命中，且为生成结果前的必填项。',
    genderAria: '选择性别',
    zodiacEyebrow: '非必选',
    zodiacLabel: '选择你的星座',
    zodiacHelp: '知道的话可以补充，不知道可以跳过；它只做轻度辅助，不会完全决定结果。',
    zodiacAria: '选择星座',
    stageAria: '关系阶段进度',
    toastCloseAria: '关闭阶段提示',
    submitHint: '完成后会跳转到独立结果页',
    submitLoading: '正在载入题目',
    submitIdle: '先做完全部题目',
    submitReady: '生成我的结果',
    summaryTpl: (a, t) => `已答 ${a} / ${t} 题`,
    summaryNeedGender: '还差一步：请选择性别后再提交。',
    summaryIncompleteTpl: (list) => `还差：${list.join('、')}（未作答）`,
    kindScale4: '单选题',
    kindChoice3: '单选题',
    kindChat: (n) => `聊天题 · ${n}选1`,
    kindRank: (n) => `排序题 · ${n}项`,
    kindMulti: (n) => `多选题 · ${n}项`,
    kindWild: (n) => `恶搞题 · ${n}选1`,
    rankHint: '从最重要到最不重要依次选择；点已选项可撤回。',
    placeholderGender: '点击选择（必选）',
    placeholderZodiac: '点击选择（可选）',
    rankYourOrder: '你的排序',
    rankRemaining: '待排序',
    rankTapUndo: '点此撤回',
    rankWaitingPick: '等待选择',
    rankBankHint: '按重要性依次点选',
    rankFinished: '已完成排序，如需调整可点上方已选项撤回。',
    stageAdvanceKicker: '关卡推进',
    stageAllDoneKicker: '全关卡通关',
    stageEnterTpl: (cat) => `进入「${cat}」`,
    stageAllStagesDone: '全部关系阶段已通关',
    stageFloatingAllDone: '全部完成',
    stageFallbackIntro: '正在推进这一阶段的答题体验。',
    stageFallbackDoneTpl: (cat) => `你已经完成「${cat}」，继续进入下一阶段吧。`,
    multiTip: '可多选',
    multiHint: '这题可多选，点击多个选项即可',
    summaryRemainGenderTpl: (n) => `还差 ${n} 题，且需选择性别`,
    summaryRemainTpl: (n) => `还差 ${n} 题`,
    summaryMissingTpl: (list) => `（未做：${list.join('、')}）`,
    summaryNeedGenderLabel: '请选择性别后生成结果',
    summaryReadyLabel: '已完成，可生成结果',
    submitNeedQuestions: '先做完题并选择性别',
    submitDoQuestions: '先做完全部题目',
    submitPickGender: '请选择性别',
    submitGenerate: '生成结果并跳转',
  };

  STRINGS.en.quiz = {
    docTitle: 'CPTI | Quiz',
    metaDesc: 'Short cards based on 26 archetypes, required gender, optional zodiac nudge, then a dedicated results page.',
    brandAria: 'Back to home',
    navResult: 'Results',
    restart: 'Reset quiz',
    restartConfirm: 'Clear all answers, gender, and zodiac saved in this browser and restart?',
    h1: 'Who you resemble in love — and who tends to fit you',
    sub: 'Pick what feels true, not what sounds ideal.',
    genderEyebrow: 'Required',
    genderLabel: 'Gender',
    genderHelp: 'Used lightly to tune a few gendered archetype names; required before results.',
    genderAria: 'Choose gender',
    zodiacEyebrow: 'Optional',
    zodiacLabel: 'Zodiac / sun sign',
    zodiacHelp: 'Skip if unsure — this is a light nudge, not a decider.',
    zodiacAria: 'Choose zodiac',
    stageAria: 'Relationship chapter progress',
    toastCloseAria: 'Close stage toast',
    submitHint: 'You will jump to a separate results page when finished.',
    submitLoading: 'Loading questions…',
    submitIdle: 'Finish all questions first',
    submitReady: 'Generate my results',
    summaryTpl: (a, t) => `${a} / ${t} answered`,
    summaryNeedGender: 'Pick a gender to generate results.',
    summaryIncompleteTpl: (list) => `Still open: ${list.join(', ')}`,
    kindScale4: 'Single choice',
    kindChoice3: 'Single choice',
    kindChat: (n) => `Chat pick · choose 1 of ${n}`,
    kindRank: (n) => `Ranking · ${n} items`,
    kindMulti: (n) => `Multi-select · ${n} items`,
    kindWild: (n) => `Joke pick · choose 1 of ${n}`,
    rankHint: 'Tap from most to least important; tap again to undo.',
    placeholderGender: 'Tap to choose (required)',
    placeholderZodiac: 'Tap to choose (optional)',
    rankYourOrder: 'Your ranking',
    rankRemaining: 'Pool',
    rankTapUndo: 'Tap to undo',
    rankWaitingPick: 'Waiting for pick',
    rankBankHint: 'Tap items in priority order',
    rankFinished: 'Ranking complete — tap a picked item above to adjust.',
    stageAdvanceKicker: 'Stage up',
    stageAllDoneKicker: 'All stages cleared',
    stageEnterTpl: (cat) => `Entering: ${cat}`,
    stageAllStagesDone: 'All relationship chapters cleared',
    stageFloatingAllDone: 'All done',
    stageFallbackIntro: 'Moving through this chapter of prompts.',
    stageFallbackDoneTpl: (cat) => `You cleared “${cat}” — onto the next chapter.`,
    multiTip: 'Multi',
    multiHint: 'Select multiple options — tap again to toggle.',
    summaryRemainGenderTpl: (n) => `${n} questions left — pick gender too`,
    summaryRemainTpl: (n) => `${n} questions left`,
    summaryMissingTpl: (list) => `(Open: ${list.join(', ')})`,
    summaryNeedGenderLabel: 'Pick gender to generate results',
    summaryReadyLabel: 'Ready — generate results',
    submitNeedQuestions: 'Finish questions + gender',
    submitDoQuestions: 'Finish all questions first',
    submitPickGender: 'Choose gender',
    submitGenerate: 'Generate results',
  };

  const STAGE_KEYS = ['探索期', '心动期', '甜蜜期', '磨合期', '稳定期', '冲突期', '结束期'];

  STRINGS.zh.quiz.stages = {
    探索期: {
      title: '关卡 01｜雷达刚开机',
      intro: '像新手村：先感受第一眼吸引力，也看看你会怎么放出信号。',
      completion: '恭喜通关「探索期」——暧昧副本已解锁，继续点选你的真实反应就好~',
    },
    心动期: {
      title: '关卡 02｜心动条在涨',
      intro: '试探和上头并行，像 combo 连击：关系开始往前推。',
      completion: '心动值明显飙升！下一关会更考验「你敢不敢把喜欢说清楚」。',
    },
    甜蜜期: {
      title: '关卡 03｜热恋滤镜 ON',
      intro: '表白、约会、热恋化学反应——选最像你的那一招。',
      completion: '高糖阶段存档完毕～滤镜会慢慢变薄，真实相处副本要开场啦。',
    },
    磨合期: {
      title: '关卡 04｜日常里见真章',
      intro: '距离、误会、情绪温差都会出现：你怎么拆招？',
      completion: '磨合关通过！你们已经更像「能一起修 bug 的队友」了。',
    },
    稳定期: {
      title: '关卡 05｜长线运营',
      intro: '价值观、表达方式、分工——把喜欢过成日常的隐藏题。',
      completion: '稳定羁绊 +1。再往前，会碰到底线与选择的硬题哦。',
    },
    冲突期: {
      title: '关卡 06｜情绪 Boss 战',
      intro: '冲突像放大器：沟通习惯、底线、谁先低头，一次看清。',
      completion: '最难的波次快结束了——下一章看你如何体面收尾或翻盘。',
    },
    结束期: {
      title: '关卡 07｜终幕演出',
      intro: '故事收尾时，你怎么对自己、也对 Ta 交代？',
      completion: '全剧情通关！去生成你的「恋爱角色卡」吧——记得长按保存分享图。',
    },
  };

  STRINGS.en.quiz.stages = {
    探索期: {
      title: 'Stage 01 · Radar online',
      intro: 'Early vibes: first sparks and how you signal interest.',
      completion: 'Exploration cleared — the “maybe-more” arc unlocks. Keep answering honestly.',
    },
    心动期: {
      title: 'Stage 02 · Heart meter rising',
      intro: 'Crush energy: testing, tension, and momentum.',
      completion: 'Big feelings checkpoint passed — next is saying the quiet part out loud.',
    },
    甜蜜期: {
      title: 'Stage 03 · Sweet spot',
      intro: 'Confessions, dates, honeymoon chemistry — pick what feels most you.',
      completion: 'High-sugar arc saved — everyday reality comes next.',
    },
    磨合期: {
      title: 'Stage 04 · Real life',
      intro: 'Distance, misunderstandings, mood swings — how do you handle them?',
      completion: 'Friction level cleared — you look more like teammates who debug together.',
    },
    稳定期: {
      title: 'Stage 05 · Long run',
      intro: 'Values, communication, roles — turning love into a daily practice.',
      completion: 'Stability buff +1 — harder boundary questions ahead.',
    },
    冲突期: {
      title: 'Stage 06 · Conflict boss fight',
      intro: 'Conflict amplifies habits: repair, pride, and who moves first.',
      completion: 'Hardest waves are almost over — next is closure or reset.',
    },
    结束期: {
      title: 'Stage 07 · Finale',
      intro: 'When a story ends, how do you treat yourself — and them?',
      completion: 'All chapters cleared — generate your card and long-press to save.',
    },
  };

  STRINGS.zh.quiz.milestones = {
    25: { kicker: '进度 Buff', title: '已完成约 25%', copy: '牌组暖机完毕～后段会有几次关键抉择，选最真实的你就对了。' },
    50: { kicker: '中场结算', title: '过半啦！', copy: '像打完上半场：喝口水，继续把直觉交给下一组题目。' },
    75: { kicker: 'Boss 门前', title: '约 75% 啦', copy: '最后一段最考验本能反应；坚持一下，你的「命中感」会更准。' },
  };

  STRINGS.en.quiz.milestones = {
    25: { kicker: 'Warm-up', title: '~25% done', copy: 'Deck warmed up — a few fork-in-the-road prompts ahead. Stay honest.' },
    50: { kicker: 'Halftime', title: 'Halfway', copy: 'Hydrate, breathe, keep trusting your first instinct.' },
    75: { kicker: 'Final stretch', title: '~75% done', copy: 'Last stretch rewards gut answers — you are almost there.' },
  };

  STRINGS.zh.result = {
    docTitle: 'CPTI | 恋爱人格结果',
    metaDesc: 'CPTI 结果页：展示你的恋爱人格、最匹配类型与完整人格图鉴；支持通过链接分享同一配方预览。',
    brandAria: '返回首页',
    restart: '重新测试',
    restartConfirm: '确认清空当前结果并重新开始测试吗？这会删除当前测试进度和结果记录。',
    headingDefault: '你的恋爱人格配方',
    headingTa: 'Ta的恋爱人格配方',
    eyebrowDefault: '你的 CPTI 配方',
    eyebrowTa: 'Ta 的 CPTI 配方',
    headingLead: '完成测试后，这里会展示你的人格类型与最匹配类型。',
    emptyTitle: '还没有可展示的结果',
    emptyTitleBad: '链接里的结果无效',
    emptyCopy: '先去测试页做完题，或让朋友发你带参数的分享链接。',
    emptyCopyBad: '参数可能写错或人格类型已更新。你可以重新测试，或请朋友重新复制分享链接。',
    ctaQuiz: '去做题',
    ctaHome: '返回首页',
    catalogEyebrow: '完整人格图鉴',
    catalogH2: '同一套人格列表，从两个角度命中你',
    catalogIntroTpl: (n) => `下面这${n}个类型，既可能是你自己，也可能是最和你匹配的恋人类型；点开卡片还能继续看完整详情。`,
    insightTags: '关系关键词',
    insightNote: '一句话提醒',
    selfPanel: '你的恋爱人格',
    selfPanelTa: 'Ta 的恋爱人格',
    needPanel: '最和你匹配的类型',
    needPanelTa: '和 Ta 最匹配的类型',
    rarity: '稀有度',
    ease: '容易被拿下程度',
    easeEn: 'Ease to “catch”',
    fit: '命中感',
    detailCta: '查看详细恋爱人格',
    detailAriaTpl: (name) => `查看 ${name} 的详细恋爱人格`,
    catalogCardAriaTpl: (name) => `查看 ${name} 人格详情`,
    shareSelf: '分享我的画像',
    shareSelfAria: '生成并预览我的画像长图',
    shareMatch: '我的匹配对象',
    shareMatchAria: '生成并预览匹配对象卡片',
    shareGenerating: '生成中...',
    shareFailed: '生成失败，请重试',
    shareModalClose: '关闭分享预览',
    shareTip: '长按图片保存到本地分享',
    shareSlideAriaTpl: (i, title) => `查看第 ${i} 张：${title}`,
    shareGalleryAria: '分享图片预览',
    shareIndicatorsAria: '分享图片分页',
    docTitleTa: 'Ta的恋爱人格配方 | CPTI',
    catalogBadgeSelf: '你自己',
    catalogBadgeNeed: '适合你',
  };

  STRINGS.en.result = {
    docTitle: 'CPTI | Love personality results',
    metaDesc: 'See your love-personality match, complementary type, and full roster — shareable via link snapshot.',
    brandAria: 'Back to home',
    restart: 'Retake quiz',
    restartConfirm: 'Clear saved results and quiz progress in this browser and restart?',
    headingDefault: 'Your love-personality recipe',
    headingTa: "Their love-personality recipe",
    eyebrowDefault: 'Your CPTI blend',
    eyebrowTa: 'Their CPTI blend',
    headingLead: 'After the quiz, your top type and best-fit partner style show up here.',
    emptyTitle: 'No results yet',
    emptyTitleBad: 'This link is not valid',
    emptyCopy: 'Take the quiz first, or ask a friend to resend a share link with parameters.',
    emptyCopyBad: 'The link may be outdated or mistyped. Retake the quiz or ask for a fresh link.',
    ctaQuiz: 'Take the quiz',
    ctaHome: 'Back to home',
    catalogEyebrow: 'Full roster',
    catalogH2: 'Same archetypes — two angles on you',
    catalogIntroTpl: (n) => `These ${n} types may describe you, the partner energy you need, or both — open a card for the long read.`,
    insightTags: 'Relationship keywords',
    insightNote: 'One-line reminder',
    selfPanel: 'Your love personality',
    selfPanelTa: 'Their love personality',
    needPanel: 'Type that tends to fit you',
    needPanelTa: 'Type that tends to fit them',
    rarity: 'Rarity',
    ease: 'Ease to “catch”',
    easeEn: 'Ease to “catch”',
    fit: 'Match feel',
    detailCta: 'Open full profile',
    detailAriaTpl: (name) => `Open ${name} profile`,
    catalogCardAriaTpl: (name) => `Open ${name} profile`,
    shareSelf: 'Share my card',
    shareSelfAria: 'Generate my share image preview',
    shareMatch: 'My match card',
    shareMatchAria: 'Generate match card preview',
    shareGenerating: 'Rendering…',
    shareFailed: 'Could not render — try again',
    shareModalClose: 'Close preview',
    shareTip: 'Long-press the image to save locally and share',
    shareSlideAriaTpl: (i, title) => `Slide ${i}: ${title}`,
    shareGalleryAria: 'Share image preview',
    shareIndicatorsAria: 'Share image pager',
    docTitleTa: 'Their CPTI recipe | CPTI',
    catalogBadgeSelf: 'You',
    catalogBadgeNeed: 'Fit',
  };

  STRINGS.zh.profile = {
    docTitleTpl: (name) => `CPTI | ${name} 人格详情`,
    metaDesc: '查看 CPTI 恋爱人格详情，了解每一种人格在亲密关系中的表现方式，以及更适合你的恋爱建议。',
    brandAria: '返回首页',
    emptyTitle: '没有找到对应的人格详情',
    emptyCopy: '你可以返回首页重新选择人格卡片，或者先去测试页完成测试后再查看结果。',
    notFoundDocTitle: 'CPTI | 未找到人格详情',
    footer: '人格详情用于帮助你理解恋爱中的相处倾向与建议，不替代专业关系咨询。',
    rarity: '稀有度',
    ease: '容易被拿下程度',
    radarEyebrow: '相处小雷达',
    radarH2: '这类人格在关系里常见的张力与早期信号',
    adviceEyebrow: '继续探索',
    adviceH2Tpl: (name) => `给${name}型的三条提醒`,
    adviceLead: '这些建议不是要你改变个性，而是帮你在保留底色的前提下，把关系过得更稳、更舒服。',
    ctaRetake: '重新测试',
    ctaResult: '查看结果页',
    ctaH2: '换一种角度再看你的关系模式',
    ctaP: '你可以回到测试页重新作答，也可以回到结果页看看自己最后命中的人格组合。',
    sectionLoveEyebrow: '恋爱里的表现',
    sectionLoveH2Tpl: (name) => `${name} 型通常会怎样爱`,
    sectionMatchEyebrow: '更适合你的关系节奏',
    sectionMatchH2: '什么样的伴侣最和你匹配',
    avatarAltTpl: (name) => `${name} 头像`,
    sources: {
      home: { label: '来自首页人格图鉴', backText: '返回首页' },
      result: { label: '来自结果页完整图鉴', backText: '返回结果页' },
      self: { label: '你的测试结果人格', backText: '返回结果页' },
      need: { label: '最和你匹配的类型', backText: '返回结果页' },
    },
  };

  STRINGS.en.profile = {
    docTitleTpl: (name) => `CPTI | ${name}`,
    metaDesc: 'Deep dive on one CPTI love-personality archetype: patterns, fit, and practical notes.',
    brandAria: 'Back to home',
    emptyTitle: 'Profile not found',
    emptyCopy: 'Pick a card from the home catalog or finish the quiz first.',
    notFoundDocTitle: 'CPTI | Profile not found',
    footer: 'For reflection and fun — not a substitute for professional counseling.',
    rarity: 'Rarity',
    ease: 'Ease to “catch”',
    radarEyebrow: 'Compatibility radar',
    radarH2: 'Typical tension points and early signals',
    adviceEyebrow: 'Keep exploring',
    adviceH2Tpl: (name) => `Three notes for the “${name}” vibe`,
    adviceLead: 'Not to erase your style — to keep relationships steadier and kinder.',
    ctaRetake: 'Retake quiz',
    ctaResult: 'Open results',
    ctaH2: 'See your pattern from another angle',
    ctaP: 'Retake the quiz or return to your latest result blend.',
    sectionLoveEyebrow: 'How you love',
    sectionLoveH2Tpl: (name) => `How “${name}” tends to show up`,
    sectionMatchEyebrow: 'Fit & pacing',
    sectionMatchH2: 'Partner styles that often work better',
    avatarAltTpl: (name) => `${name} avatar`,
    sources: {
      home: { label: 'From home catalog', backText: 'Back to home' },
      result: { label: 'From results roster', backText: 'Back to results' },
      self: { label: 'From your latest result', backText: 'Back to results' },
      need: { label: 'From your match type', backText: 'Back to results' },
    },
  };

  STRINGS.zh.shareCard = {
    roleSelf: '自身',
    roleMatch: '匹配',
    subtitleSelf: '属于你的角色简介',
    subtitleMatch: '与他的角色简介',
    footerSelf: '长按保存「角色卡片」· 记录此刻（仅供娱乐）',
    footerMatch: '长按保存「羁绊角色卡片」· 适合与 Ta 一起收藏（仅供娱乐）',
    banner: '限定卡面 · CPTI',
    portraitSelf: '卡面立绘',
    portraitMatch: '羁绊立绘',
    statFavor: '好感度',
    statFavorSub: '恋爱相性',
    statGuard: '守护力',
    statGuardSub: '情绪护盾',
    statBond: '羁绊值',
    statBondSub: '心动同步',
    collId: '收藏编号',
    pulseFit: '心动契合',
    ease: '易捕捉程度',
    rarity: '角色稀有度',
    keywords: '关键词',
    bioTitle: '角色简介',
    skillTitle: '专属技能',
    footerBrand: '恋爱人格实验室 · 角色卡片',
    flavorPrefix: '心语：',
    slideTitleSelf: '我的恋爱人格画像',
    slideSubSelf: '你的恋爱人格',
    slideAltSelfTpl: (name) => `${name || '你的恋爱人格'} 分享图`,
    slideTitleMatch: '和我匹配的人格画像',
    slideSubMatch: '匹配人格',
    slideAltMatchTpl: (name) => `${name || '匹配人格'} 分享图`,
    tagLinePrefix: '关键词：',
    introFallbackSelf: '你的恋爱人格角色卡已解锁。',
    skillFallbackSelf: '正在等待你在关系里继续解锁更多剧情。',
    typeLineSuffix: '恋爱人格角色',
    rareBadgeTpl: (lbl) => `♥ ${lbl} 稀有`,
    compareVs: 'VS',
    footerLabTitle: 'CPTI 恋爱人格实验室',
    footerFinePrint: 'cpti.cc © 兰州小红鸡 · 限定卡面仅供分享',
    ownerSummaryTpl: (sr, sn, nr, nn) => `恭喜你，测出来你是属于稀有度${sr}的${sn}型恋爱人格，和你最匹配的是稀有度${nr}的${nn}型恋爱人格。`,
  };

  STRINGS.en.shareCard = {
    roleSelf: 'You',
    roleMatch: 'Match',
    subtitleSelf: 'Your character blurb',
    subtitleMatch: 'Their character blurb',
    footerSelf: 'Long-press to save this character card (for fun only)',
    footerMatch: 'Long-press to save this bond character card (for fun only)',
    banner: 'Limited card art · CPTI',
    portraitSelf: 'Portrait',
    portraitMatch: 'Bond portrait',
    statFavor: 'Affection',
    statFavorSub: 'Chemistry',
    statGuard: 'Steadiness',
    statGuardSub: 'Emotional shield',
    statBond: 'Bond',
    statBondSub: 'Heart sync',
    collId: 'Collect no.',
    pulseFit: 'Fit meter',
    ease: 'Ease to catch',
    rarity: 'Role rarity',
    keywords: 'Keywords',
    bioTitle: 'Bio',
    skillTitle: 'Signature move',
    footerBrand: 'Love-personality lab · character card',
    flavorPrefix: 'Whisper: ',
    slideTitleSelf: 'My love-personality card',
    slideSubSelf: 'Your archetype',
    slideAltSelfTpl: (name) => `${name || 'Love personality'} share image`,
    slideTitleMatch: 'My match archetype',
    slideSubMatch: 'Match type',
    slideAltMatchTpl: (name) => `${name || 'Match'} share image`,
    tagLinePrefix: 'Keywords: ',
    introFallbackSelf: 'Your love-personality card is unlocked.',
    skillFallbackSelf: 'More story unlocks as you keep living your pattern.',
    typeLineSuffix: 'archetype',
    rareBadgeTpl: (lbl) => `♥ ${lbl} · rare`,
    compareVs: 'VS',
    footerLabTitle: 'CPTI love-personality lab',
    footerFinePrint: 'cpti.cc · for sharing only',
    ownerSummaryTpl: (sr, sn, nr, nn) => `You mapped to rarity ${sr} “${sn}”, and your top-fit partner vibe is rarity ${nr} “${nn}”.`,
  };

  STRINGS.zh.copy = {
    formulaNoteDefault: '每个人表达爱的方式不同，而舒服的关系，通常来自能理解你、也能接住你的人。',
    formulaNoteSnapshot: '这是友人的结果预览。想知道自己在关系里更像谁，可以去测试页完成同一套题目并生成你的配方。',
    formulaSummaryOwnTpl: (sn, sNote, nn, nNote) => `你在关系里更像「${sn}」：${sNote} 而最和你匹配的，往往是「${nn}」这种类型：${nNote}`,
    formulaSummarySnapTpl: (sn, sNote, nn) => `这是 Ta 分享的 CPTI 快照：Ta 更像「${sn}」，也最容易和「${nn}」这种类型产生化学反应。`,
    linkIntroSnapTpl: (sr, sn, nr, nn) => `你的朋友 Ta 测出来，Ta 属于稀有度${sr}的「${sn}」型恋爱人格；和 Ta 最匹配的是稀有度${nr}的「${nn}」型恋爱人格。`,
  };

  STRINGS.en.copy = {
    formulaNoteDefault: 'People love differently — the easiest relationships usually feel understood, not forced.',
    formulaNoteSnapshot: 'Friend snapshot. Take the same quiz to see your own recipe.',
    formulaSummaryOwnTpl: (sn, sNote, nn, nNote) => `You read most like “${sn}”: ${sNote} People who fit you best often feel like “${nn}”: ${nNote}`,
    formulaSummarySnapTpl: (sn, sNote, nn) => `Their CPTI snapshot: they resemble “${sn}”, and they tend to spark with “${nn}”.`,
    linkIntroSnapTpl: (sr, sn, nr, nn) => `Your friend mapped to rarity ${sr} “${sn}”; their top-fit vibe is rarity ${nr} “${nn}”.`,
  };

  const t = (path) => {
    const parts = String(path).split('.');
    let cur = STRINGS[activeLocale];
    for (const p of parts) {
      cur = cur?.[p];
    }
    if (cur === undefined) {
      let fb = STRINGS.zh;
      for (const p of parts) fb = fb?.[p];
      return fb;
    }
    return cur;
  };

  const zodiacLabelsEn = [
    '',
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];

  const genderLabelsEn = {
    '': 'Tap to choose (required)',
    female: 'Woman',
    male: 'Man',
    nonbinary: 'Non-binary / other',
  };

  const getZodiacOptionLabel = (chineseValue, index) => {
    if (!chineseValue) {
      return activeLocale === 'en' ? (t('quiz.placeholderZodiac') || 'Optional') : '点击选择（可选）';
    }
    if (activeLocale !== 'en') return chineseValue;
    return zodiacLabelsEn[index] || chineseValue;
  };

  const getGenderLabelMap = () => (activeLocale === 'en' ? genderLabelsEn : null);

  const localizeProfile = (profile) => {
    if (!profile || activeLocale !== 'en') return profile;
    const ov = window.CPTI_PROFILE_LOCALE_EN?.[profile.id];
    if (!ov) return profile;
    return { ...profile, ...ov, tags: ov.tags || profile.tags, advice: ov.advice || profile.advice };
  };

  const taifyNeedEn = (text = '') => String(text || '')
    .replace(/\bYou're\b/g, "They're")
    .replace(/\bYou are\b/gi, 'They are')
    .replace(/\bYou\b/g, 'They')
    .replace(/\bYour\b/g, 'Their')
    .replace(/\byou're\b/g, "they're")
    .replace(/\byou are\b/gi, 'they are')
    .replace(/\byou\b/g, 'they')
    .replace(/\byour\b/g, 'their');

  const formatFormulaTitle = (selfName, needName, { snapshot = false } = {}) => {
    const sep = snapshot ? ' × ' : ' vs ';
    return `${selfName}${sep}${needName}`;
  };

  const formatComputedCopy = (computed) => {
    if (!computed) return computed;
    const loc = activeLocale;
    if (loc === 'zh') return computed;
    const S = STRINGS.en.copy;
    const sp = localizeProfile(computed.selfProfile);
    const np = localizeProfile(computed.needProfile);
    const next = { ...computed };
    if (computed.fromLinkSnapshot) {
      next.linkSnapshotHeadingIntro = S.linkIntroSnapTpl(
        computed.selfProfile && window.CPTI_DATA?.getProfileRarityLabel?.(computed.selfProfile.id),
        sp.name,
        computed.needProfile && window.CPTI_DATA?.getProfileRarityLabel?.(computed.needProfile.id),
        np.name,
      );
      next.formulaSummary = S.formulaSummarySnapTpl(sp.name, sp.note, np.name);
      next.note = S.formulaNoteSnapshot;
    } else {
      next.formulaSummary = S.formulaSummaryOwnTpl(sp.name, sp.note, np.name, taifyNeedEn(np.note));
      next.note = S.formulaNoteDefault;
    }
    next.formulaTitle = formatFormulaTitle(sp.name, np.name, { snapshot: !!computed.fromLinkSnapshot });
    return next;
  };

  const mergeQuestionToDisplay = (question) => {
    if (!question || activeLocale !== 'en') return question;
    const en = window.CPTI_QUESTIONS_EN?.[question.id];
    if (!en) return question;
    return {
      ...question,
      category: en.category || question.category,
      prompt: en.prompt || question.prompt,
      hint: en.hint ?? question.hint,
      dialogue: Array.isArray(en.dialogue) && en.dialogue.length ? en.dialogue : question.dialogue,
      options: question.options.map((option, index) => ({
        ...option,
        label: en.options?.[index] ?? option.label,
      })),
    };
  };

  const getStageBlock = (categoryZh) => {
    const pack = STRINGS[activeLocale]?.quiz?.stages?.[categoryZh]
      || STRINGS.zh.quiz.stages[categoryZh];
    if (pack) return pack;
    return {
      title: categoryZh,
      intro: t('quiz.stageFallbackIntro'),
      completion: typeof t('quiz.stageFallbackDoneTpl') === 'function'
        ? t('quiz.stageFallbackDoneTpl')(categoryZh)
        : `Completed ${categoryZh}`,
    };
  };

  const getMilestoneBlock = (pct) => STRINGS[activeLocale]?.quiz?.milestones?.[pct]
    || STRINGS.zh.quiz.milestones[pct];

  const mountLanguageSwitch = (root = document) => {
    const host = root.querySelector?.('[data-lang-switch]') || document.querySelector('[data-lang-switch]');
    if (!host) return;
    host.innerHTML = '';
    const mkBtn = (code, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `lang-switch-btn${activeLocale === code ? ' is-active' : ''}`;
      b.dataset.setLang = code;
      b.textContent = label;
      return b;
    };
    host.appendChild(mkBtn('zh', STRINGS.zh.common.langZh));
    host.appendChild(mkBtn('en', STRINGS.en.common.langEn));
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-lang]');
      if (!btn) return;
      const code = normalizeLocale(btn.dataset.setLang);
      if (code === activeLocale) return;
      setLocale(code, { reload: true });
    });
  };

  const applyDocumentLang = () => {
    document.documentElement.lang = activeLocale === 'en' ? 'en' : 'zh-CN';
  };

  window.CPTI_I18N = {
    STORAGE_KEY,
    SUPPORTED,
    STAGE_KEYS,
    normalizeLocale,
    initFromUrl,
    getLocale: () => activeLocale,
    setLocale,
    withLang,
    mergeLangIntoSearch,
    t,
    zodiacLabelsEn,
    getZodiacOptionLabel,
    getGenderLabelMap,
    localizeProfile,
    taifyNeedEn,
    formatFormulaTitle,
    formatComputedCopy,
    mergeQuestionToDisplay,
    getStageBlock,
    getMilestoneBlock,
    mountLanguageSwitch,
    applyDocumentLang,
    STRINGS,
  };

  initFromUrl();
  applyDocumentLang();
})();
