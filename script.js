/* Small, dependency-free interactions for the portfolio. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // Artwork gallery: user-controlled rather than autoplaying, so it stays calm
  // and gives visitors time to read and inspect each image.
  const slides = $$('.artwork-slide');
  const artworkButtons = $$('.artwork-index button');
  const currentSlide = $('#current-slide');
  let activeSlide = 0;

  function showSlide(index) {
    if (!slides.length) return;
    activeSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === activeSlide;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    artworkButtons.forEach((button, i) => {
      const active = i === activeSlide;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (currentSlide) currentSlide.textContent = String(activeSlide + 1).padStart(2, '0');
  }

  $('#gallery-prev')?.addEventListener('click', () => showSlide(activeSlide - 1));
  $('#gallery-next')?.addEventListener('click', () => showSlide(activeSlide + 1));
  artworkButtons.forEach((button, i) => button.addEventListener('click', () => showSlide(i)));
  $('#artwork-stage')?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(activeSlide - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(activeSlide + 1);
    }
  });

  // Compact mobile navigation; Escape closes it and returns focus to its trigger.
  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');
  function closeMenu(restoreFocus = false) {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    mobileMenu.hidden = true;
    if (restoreFocus) menuToggle.focus();
  }
  menuToggle?.addEventListener('click', () => {
    const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(opening));
    menuToggle.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
    if (mobileMenu) mobileMenu.hidden = !opening;
  });
  $$('#mobile-menu a').forEach((link) => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });

  // Public GitHub API needs no secret. Never put a personal token in browser JS.
  const GITHUB_USERNAME = 'sirvi-lalit';
  const fallbackRepos = [{
    name: 'sirvi-lalit',
    description: 'Profile configuration, active learning roadmaps, and digital artwork slideshow assets.',
    html_url: 'https://github.com/sirvi-lalit/sirvi-lalit',
    language: 'Markdown',
    fork: false
  }];
  const repoGrid = $('#repo-grid');

  function createRepoEntry(repo) {
    const article = document.createElement('article');
    article.className = 'repo-entry';

    const titleGroup = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'repo-name';
    title.textContent = repo.name;
    const kind = document.createElement('p');
    kind.className = 'repo-kind';
    kind.textContent = repo.fork ? 'Forked repository' : 'Public project';
    titleGroup.append(title, kind);

    const description = document.createElement('p');
    description.className = 'repo-description';
    description.textContent = repo.description || 'Public repository focused on coding practice and learning.';

    const language = document.createElement('p');
    language.className = 'repo-language';
    language.textContent = repo.language || 'Code';

    const link = document.createElement('a');
    link.className = 'repo-link';
    // Use a verified GitHub HTTPS link; this keeps API-provided markup inert.
    const href = typeof repo.html_url === 'string' && /^https:\/\/github\.com\//.test(repo.html_url)
      ? repo.html_url
      : `https://github.com/${GITHUB_USERNAME}/${encodeURIComponent(repo.name)}`;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `View ${repo.name} on GitHub`);
    link.append(document.createTextNode('View repository '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    link.append(arrow);

    article.append(titleGroup, description, language, link);
    return article;
  }

  function renderRepos(repos, note = '') {
    if (!repoGrid) return;
    const nodes = repos.map(createRepoEntry);
    if (note) {
      const message = document.createElement('p');
      message.className = 'repo-state';
      message.textContent = note;
      nodes.push(message);
    }
    repoGrid.replaceChildren(...nodes);
    repoGrid.setAttribute('aria-busy', 'false');
  }

  function renderFallback(reason) {
    renderRepos(fallbackRepos);
    const note = document.createElement('div');
    note.className = 'repo-error';
    const message = document.createElement('span');
    message.textContent = `${reason} Showing the saved repository entry instead.`;
    const retry = document.createElement('button');
    retry.className = 'repo-retry';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', loadRepositories);
    note.append(message, retry);
    repoGrid?.append(note);
  }

  async function loadRepositories() {
    if (!repoGrid) return;
    repoGrid.setAttribute('aria-busy', 'true');
    const loading = document.createElement('p');
    loading.className = 'repo-state';
    loading.textContent = 'Loading repositories from GitHub…';
    repoGrid.replaceChildren(loading);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const endpoint = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=6`;
      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: controller.signal
      });
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub’s public API rate limit has been reached.');
      }
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('GitHub returned an unexpected response.');
      const publicRepos = payload.filter((repo) => repo && !repo.private).slice(0, 4);
      if (!publicRepos.length) throw new Error('No public repositories were returned.');
      renderRepos(publicRepos);
    } catch (error) {
      const reason = error.name === 'AbortError'
        ? 'GitHub took too long to respond.'
        : (error.message || 'GitHub could not be reached.');
      renderFallback(reason);
    } finally {
      window.clearTimeout(timeout);
      repoGrid?.setAttribute('aria-busy', 'false');
    }
  }

  loadRepositories();
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
