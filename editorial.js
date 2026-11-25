(() => {
  'use strict';
  document.body.classList.add('js');
  const printButton = document.querySelector('[data-print-cv]');
  if (printButton) {
    printButton.hidden = false;
    printButton.addEventListener('click', () => window.print());
  }
  const cvPage = document.querySelector('[data-cv-page]');
  if (cvPage && 'animate' in Element.prototype) {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    const seen = new WeakSet();
    const animate = (element, delay = 0) => {
      if (seen.has(element) || preference.matches) return;
      seen.add(element);
      const portrait = element.dataset.cvEnter === 'portrait';
      const animation = element.animate([
        { opacity: 0, transform: portrait ? 'scale(1.035)' : 'translateY(16px)', clipPath: portrait ? 'inset(0)' : 'inset(0 0 -20% 0)' },
        { opacity: 1, transform: portrait ? 'scale(1)' : 'translateY(0)', clipPath: 'inset(0 0 -20% 0)' }
      ], { duration: portrait ? 1000 : 720, delay, easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'backwards' });
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation)).catch(() => animations.delete(animation));
    };
    // Content is visible by default; motion never gates reading or printing.
    document.fonts.ready.then(() => {
      cvPage.querySelectorAll('[data-cv-enter]').forEach((element, index) => animate(element, index * 95));
    });
    const headings = cvPage.querySelectorAll('[data-cv-reveal]');
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      let delay = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animate(entry.target, delay);
        delay += 55;
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' }) : null;
    headings.forEach(heading => observer?.observe(heading));
    const finishMotion = () => animations.forEach(animation => animation.finish());
    preference.addEventListener('change', () => { if (preference.matches) finishMotion(); });
    window.addEventListener('beforeprint', finishMotion);
  }
  const menu = document.querySelector('.site-nav');
  const toggle = document.querySelector('.menu-toggle');
  const mobile = matchMedia('(max-width: 600px)');
  const setMenu = open => {
    if (!toggle || !menu) return;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('[data-menu-label]').textContent = open ? 'Cerrar' : 'Menú';
    toggle.querySelector('[data-menu-icon]').textContent = open ? '−' : '+';
    document.body.style.overflow = open && mobile.matches ? 'hidden' : '';
  };
  if (toggle && menu) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
    mobile.addEventListener('change', () => setMenu(false));
  }

  const filterBar = document.querySelector('[data-filter-bar]');
  if (filterBar) {
    filterBar.hidden = false;
    const cards = [...document.querySelectorAll('[data-category]')];
    const status = document.querySelector('[data-filter-count]');
    filterBar.addEventListener('click', e => {
      const button = e.target.closest('[data-filter]');
      if (!button) return;
      filterBar.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      const category = button.dataset.filter;
      cards.forEach(card => { card.hidden = category !== 'all' && !card.dataset.category.split(' ').includes(category); });
      const count = cards.filter(c => !c.hidden).length;
      status.textContent = `${count} ${count === 1 ? 'proyecto' : 'proyectos'}`;
    });
  }

  // Render previews load only on screen. Every moving frame can be paused independently.
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const previewStates = new Set();
  const canAutoplay = () => !motionPreference.matches && !navigator.connection?.saveData;
  const paintPreviewButton = state => {
    const playing = !state.video.paused && !state.video.ended;
    const action = playing ? 'Pausar' : 'Reproducir';
    state.button.querySelector('[data-video-action]').textContent = action;
    state.button.querySelector('[aria-hidden]').textContent = playing ? 'Ⅱ' : '▶';
    state.button.setAttribute('aria-label', `${action} vídeo: ${state.host.dataset.videoLabel}`);
  };
  const playPreview = state => {
    if (document.hidden || state.userPaused || (!state.manual && !canAutoplay())) return;
    if (!state.video.getAttribute('src')) {
      const lightPreview = mobile.matches || state.host.classList.contains('work-card');
      state.video.src = lightPreview && state.video.dataset.previewMobile ? state.video.dataset.previewMobile : state.video.dataset.previewSrc;
    }
    if (state.video.error) state.video.load();
    const attempt = state.video.play();
    attempt?.catch(() => paintPreviewButton(state));
  };
  const previewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = entry.target.previewState;
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .12;
      if (state.visible) playPreview(state);
      else state.video.pause();
    });
  }, { threshold: [0, .12] }) : null;
  document.querySelectorAll('[data-motion-media]').forEach(host => {
    const video = host.querySelector('video[data-preview-src]');
    const button = host.querySelector('[data-video-toggle]');
    if (!video || !button) return;
    const state = { host, video, button, visible: false, userPaused: false, manual: false };
    previewStates.add(state);
    video.previewState = state;
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.hidden = false; button.hidden = false;
    video.addEventListener('playing', () => { host.classList.add('is-video-ready'); paintPreviewButton(state); });
    video.addEventListener('pause', () => paintPreviewButton(state));
    video.addEventListener('error', () => { host.classList.remove('is-video-ready'); paintPreviewButton(state); });
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (!video.paused) { state.userPaused = true; video.pause(); }
      else { state.userPaused = false; state.manual = true; playPreview(state); }
    });
    if (previewObserver) previewObserver.observe(video);
    // Without IntersectionObserver, keep the image until the visitor explicitly plays it.
  });
  document.addEventListener('visibilitychange', () => {
    previewStates.forEach(state => {
      if (document.hidden) state.video.pause();
      else if (state.visible) playPreview(state);
    });
  });
  motionPreference.addEventListener('change', () => {
    previewStates.forEach(state => {
      if (motionPreference.matches && !state.manual) state.video.pause();
      else if (state.visible) playPreview(state);
    });
  });

  // Additional full-length clips retain explicit native playback controls.
  document.querySelectorAll('[data-film-details]').forEach(details => {
    details.addEventListener('toggle', () => {
      details.querySelectorAll('video').forEach(video => {
        if (details.open && video.dataset.src && !video.getAttribute('src')) video.src = video.dataset.src;
        if (!details.open) video.pause();
      });
    });
  });

  document.querySelectorAll('[data-comparison]').forEach(comparison => {
    const range = comparison.querySelector('input');
    const update = () => {
      comparison.style.setProperty('--position', `${range.value}%`);
      comparison.classList.toggle('is-drawing-visible', Number(range.value) > 0);
      range.setAttribute('aria-valuetext', `${range.value}% dibujo, ${100 - Number(range.value)}% visualización`);
    };
    range.addEventListener('input', update);
    update();
  });

  const images = [...document.querySelectorAll('.project-page .g-item img, .project-cover img, .portfolio-document img')]
    .filter(image => !image.closest('[data-motion-media], [data-comparison]'));
  if (!images.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'image-dialog';
  dialog.setAttribute('aria-label', 'Visor de imágenes del proyecto');
  dialog.innerHTML = `<div class="viewer-toolbar"><p>Documento de proyecto</p><div class="viewer-actions"><button type="button" data-viewer="prev" aria-label="Imagen anterior">←</button><button type="button" data-viewer="next" aria-label="Imagen siguiente">→</button><button type="button" data-viewer="out" aria-label="Reducir imagen">−</button><button type="button" data-viewer="in" aria-label="Ampliar imagen">+</button><button type="button" data-viewer="close" aria-label="Cerrar visor">Cerrar ×</button></div></div><div class="viewer-stage"><img alt="" draggable="false"></div><div class="viewer-caption"><p data-viewer-caption></p><span class="viewer-position" aria-live="polite"></span></div>`;
  document.body.append(dialog);
  const picture = dialog.querySelector('img');
  const stage = dialog.querySelector('.viewer-stage');
  let index = 0, scale = 1, x = 0, y = 0, pointer = null, startX = 0, startY = 0, returnFocus;
  const apply = () => {
    picture.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    stage.classList.toggle('is-zoomed', scale > 1);
    dialog.querySelector('[data-viewer="out"]').disabled = scale <= 1;
    dialog.querySelector('[data-viewer="in"]').disabled = scale >= 5;
  };
  const show = i => {
    index = (i + images.length) % images.length;
    picture.src = images[index].src;
    picture.alt = images[index].alt;
    dialog.querySelector('[data-viewer-caption]').textContent = images[index].alt;
    dialog.querySelector('.viewer-position').textContent = `${index + 1} / ${images.length}`;
    scale = 1; x = y = 0; apply();
  };
  const zoom = factor => { scale = Math.min(5, Math.max(1, scale * factor)); if (scale === 1) x = y = 0; apply(); };
  images.forEach((img, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'zoom-trigger';
    button.setAttribute('aria-label', `Ampliar: ${img.alt || 'imagen de proyecto'}`);
    img.before(button); button.append(img);
    button.addEventListener('click', () => { returnFocus = button; show(i); dialog.showModal(); dialog.querySelector('[data-viewer="close"]').focus(); });
  });
  dialog.addEventListener('click', e => {
    const action = e.target.closest('[data-viewer]')?.dataset.viewer;
    if (action === 'close') dialog.close();
    if (action === 'prev') show(index - 1);
    if (action === 'next') show(index + 1);
    if (action === 'in') zoom(1.4);
    if (action === 'out') zoom(1 / 1.4);
  });
  dialog.addEventListener('close', () => { pointer = null; stage.classList.remove('is-dragging'); returnFocus?.focus(); });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1.4); }
    if (e.key === '-') { e.preventDefault(); zoom(1 / 1.4); }
  });
  stage.addEventListener('dblclick', () => zoom(scale > 1 ? 1 / scale : 2));
  stage.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  stage.addEventListener('pointerdown', e => {
    if (scale <= 1) return;
    pointer = e.pointerId; startX = e.clientX - x; startY = e.clientY - y;
    stage.setPointerCapture(e.pointerId); stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    x = e.clientX - startX; y = e.clientY - startY; apply();
  });
  const endDrag = () => { pointer = null; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
})();

(() => {
  const grid = document.querySelector('#proyectos .work-grid');
  if (!grid) return;
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let active, frame, x, y;
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!active) return;
    active.removeAttribute('data-tilting');
    active.style.removeProperty('--tilt-x');
    active.style.removeProperty('--tilt-y');
    active = null;
  }
  function paint() {
    frame = 0;
    const rect = active.querySelector('a').getBoundingClientRect();
    const angle = fraction => Math.max(-1, Math.min(1, fraction * 2 - 1)) * 2.4;
    active.style.setProperty('--tilt-x', -angle((y - rect.top) / rect.height) + 'deg');
    active.style.setProperty('--tilt-y', angle((x - rect.left) / rect.width) + 'deg');
    active.setAttribute('data-tilting', '');
  }
  grid.addEventListener('pointermove', event => {
    const card = event.target.closest('.work-card');
    if (!enabled.matches || event.pointerType === 'touch' || !card) return reset();
    if (card !== active) reset();
    active = card;
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  });
  grid.addEventListener('pointerleave', reset);
  grid.addEventListener('pointercancel', reset);
  enabled.addEventListener('change', reset);
  window.addEventListener('wheel', reset, { passive: true });
})();
