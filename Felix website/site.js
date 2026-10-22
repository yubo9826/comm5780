(() => {
  const filters = Array.from(document.querySelectorAll('.gallery-filter'));
  const photos = Array.from(document.querySelectorAll('.everyday-photo, .journal-photo'));
  const journalSections = Array.from(document.querySelectorAll('.journal-chapter'));
  const status = document.getElementById('gallery-status');

  function applyFilter(category) {
    let visibleCount = 0;
    photos.forEach((photo) => {
      const visible = category === 'all' || photo.dataset.category === category;
      photo.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    journalSections.forEach((section) => {
      section.hidden = category !== 'all' && section.dataset.journalSection !== category;
    });
    filters.forEach((button) => {
      const active = button.dataset.filter === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (status) {
      const labels = { city: 'city', food: 'food', journey: 'Wales', leeds: 'Leeds', daily: 'everyday' };
      const label = category === 'all' ? 'photos' : `${labels[category] || category} photos`;
      status.textContent = `Showing ${category === 'all' ? 'all ' : ''}${visibleCount} ${label}`;
    }
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  });

  const dialog = document.getElementById('photo-viewer');
  if (!dialog) return;

  const viewerImage = document.getElementById('viewer-image');
  const viewerCaption = document.getElementById('viewer-caption');
  const viewerCounter = document.getElementById('viewer-counter');
  const closeButton = dialog.querySelector('.viewer-close');
  const previousButton = dialog.querySelector('.viewer-previous');
  const nextButton = dialog.querySelector('.viewer-next');
  let currentItems = [];
  let currentIndex = 0;
  let lastTrigger = null;

  function visibleItems(group) {
    return Array.from(document.querySelectorAll(`.photo-trigger[data-gallery="${group}"]`))
      .filter((trigger) => !trigger.closest('[hidden]')); 
  }

  function showItem(index) {
    if (!currentItems.length) return;
    currentIndex = (index + currentItems.length) % currentItems.length;
    const trigger = currentItems[currentIndex];
    const image = trigger.querySelector('img');
    const figure = trigger.closest('figure');
    const caption = figure?.querySelector('figcaption span, figcaption')?.textContent?.trim();
    viewerImage.src = image.currentSrc || image.src;
    viewerImage.alt = image.alt;
    viewerCaption.textContent = caption || image.alt;
    viewerCounter.textContent = `${currentIndex + 1} / ${currentItems.length}`;
    const hasMultiple = currentItems.length > 1;
    previousButton.hidden = !hasMultiple;
    nextButton.hidden = !hasMultiple;
  }

  document.querySelectorAll('.photo-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      currentItems = visibleItems(trigger.dataset.gallery);
      currentIndex = currentItems.indexOf(trigger);
      lastTrigger = trigger;
      showItem(currentIndex);
      if (!dialog.open) dialog.showModal();
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', () => dialog.close());
  previousButton.addEventListener('click', () => showItem(currentIndex - 1));
  nextButton.addEventListener('click', () => showItem(currentIndex + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    viewerImage.removeAttribute('src');
    if (lastTrigger?.isConnected) lastTrigger.focus();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showItem(currentIndex - 1);
    if (event.key === 'ArrowRight') showItem(currentIndex + 1);
  });
})();

// Site-wide motion and small interactive touches.
(() => {
  const progressBar = document.querySelector('.scroll-progress span');
  const backToTop = document.querySelector('.back-to-top-float');
  let ticking = false;

  function updateScrollUI() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    if (progressBar) progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
    if (backToTop) {
      const nearFooter = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
      backToTop.classList.toggle('is-visible', window.scrollY > 420 && !nearFooter);
    }
    ticking = false;
  }

  function requestScrollUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollUI);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  updateScrollUI();

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  const revealTargets = document.querySelectorAll(
    '.hero-copy, .hero-card, .section-block, .module-card, .exploration-card, .interest-item, .leeds-hero-copy, .leeds-hero-image, .campus-photo, .everyday-photo, .journal-photo'
  );
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (revealTargets.length && !reduceMotion && 'IntersectionObserver' in window) {
    revealTargets.forEach((element, index) => {
      element.dataset.reveal = '';
      if (element.matches('.module-card, .exploration-card, .interest-item, .campus-photo, .everyday-photo, .journal-photo')) {
        element.style.setProperty('--reveal-delay', `${(index % 3) * 90}ms`);
      }
    });
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    revealTargets.forEach((element) => observer.observe(element));
  } else {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
  }

  const switchButton = document.getElementById('interest-switch');
  if (switchButton) {
    const slides = [
      { caption: 'Curious about', title: 'AI video<br>generation', description: 'New tools, new images, new ways to tell a story.', core: 'AI', label: 'Show R&B interest' },
      { caption: 'Always playing', title: 'R&amp;B<br>music', description: 'A soundtrack for study breaks, walks and slow mornings.', core: '♫', label: 'Show AI video interest' },
    ];
    const copy = document.getElementById('interest-copy');
    const caption = document.getElementById('interest-caption');
    const title = document.getElementById('interest-title');
    const description = document.getElementById('interest-description');
    const core = document.getElementById('interest-core');
    const art = document.getElementById('interest-art');
    const indexLabel = document.getElementById('interest-index');
    let activeSlide = 0;
    let changing = false;

    switchButton.addEventListener('click', () => {
      if (changing) return;
      changing = true;
      copy.classList.add('is-changing');
      window.setTimeout(() => {
        activeSlide = (activeSlide + 1) % slides.length;
        const slide = slides[activeSlide];
        caption.textContent = slide.caption;
        title.innerHTML = slide.title;
        description.textContent = slide.description;
        core.textContent = slide.core;
        indexLabel.textContent = `0${activeSlide + 1} / 0${slides.length}`;
        switchButton.setAttribute('aria-label', slide.label);
        art.classList.toggle('is-rnb', activeSlide === 1);
        copy.classList.remove('is-changing');
        changing = false;
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    });
  }
})();
