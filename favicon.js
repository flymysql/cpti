(() => {
  const DATA = window.CPTI_DATA;
  if (!DATA?.profiles || !DATA.resolveRasterAvatarThumbUrl) return;

  const ids = Object.keys(DATA.profiles);
  if (!ids.length) return;

  const id = ids[Math.floor(Math.random() * ids.length)];
  const line = Math.random() < 0.5 ? 'male' : 'female';
  const href = DATA.resolveRasterAvatarThumbUrl(id, { quizCompleted: true, userGender: line });

  const upsert = (rel) => {
    const sel = `link[data-cpti-favicon="${rel}"]`;
    let link = document.querySelector(sel);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      link.dataset.cptiFavicon = rel;
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  };

  upsert('icon');
  upsert('apple-touch-icon');
})();
