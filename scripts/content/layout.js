import { escapeHtml } from '../shared/templates.js';

const themeIconsSvg = `<span class="theme-trigger-icon">
            <svg class="theme-icon theme-icon-dark" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7.5 7.5 0 0 0 9.8 9.8Z" fill="currentColor" />
            </svg>
            <svg class="theme-icon theme-icon-light" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
            </svg>
          </span>`;

export const buildNavbarHtml = ({
  homeUrl,
  aboutUrl,
  blogUrl,
  navAboutLabel,
  navBlogLabel,
  siteTitle,
  langSwitchMode,
}) => `
<header class="navbar" data-navbar>
  <div class="nav-inner">
    <div class="nav-left">
      <a href="${escapeHtml(homeUrl)}" class="brand">${escapeHtml(siteTitle)}</a>
      <nav class="nav-links" aria-label="Primary">
        <a class="nav-link-button" href="${escapeHtml(blogUrl)}" data-nav="blog">${escapeHtml(navBlogLabel)}</a>
        <a class="nav-link-button" href="${escapeHtml(aboutUrl)}" data-nav="about">${escapeHtml(navAboutLabel)}</a>
      </nav>
    </div>
    <div class="controls">
      <div class="action-controls">
        <div class="lang-switcher" data-lang-switcher data-lang-switcher-mode="${escapeHtml(langSwitchMode)}">
          <button class="lang-toggle" type="button" data-lang-toggle>EN</button>
        </div>
        <div class="theme-switcher" data-theme-switcher data-theme-state="light">
          <button class="theme-trigger" type="button" data-theme-trigger aria-label="Theme mode toggle" aria-pressed="false">
            ${themeIconsSvg}
          </button>
        </div>
        <a class="ask-ai-entry" href="/ask-ai/" data-ask-ai-entry aria-label="Open Ask AI">
          <span class="ask-ai-entry-label">Ask</span>
        </a>
      </div>
      <button class="nav-mobile-toggle" type="button" data-nav-mobile-toggle aria-expanded="false" aria-controls="nav-mobile-sheet" aria-label="Open menu">
        <span class="nav-mobile-toggle-bars" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</header>
<aside class="nav-mobile-sheet" id="nav-mobile-sheet" data-nav-mobile-sheet hidden>
  <a class="nav-mobile-link" href="${escapeHtml(blogUrl)}" data-nav-mobile="blog">${escapeHtml(navBlogLabel)}</a>
  <a class="nav-mobile-link" href="${escapeHtml(aboutUrl)}" data-nav-mobile="about">${escapeHtml(navAboutLabel)}</a>
  <a class="nav-mobile-link" href="/ask-ai/" data-nav-mobile="ask-ai">Ask AI</a>
  <div class="nav-mobile-utilities">
    <div class="lang-switcher" data-lang-switcher data-lang-switcher-mode="${escapeHtml(langSwitchMode)}">
      <button class="lang-toggle" type="button" data-lang-toggle>EN</button>
    </div>
    <div class="theme-switcher" data-theme-switcher data-theme-state="light">
      <button class="theme-trigger" type="button" data-theme-trigger aria-label="Theme mode toggle" aria-pressed="false">
        ${themeIconsSvg}
      </button>
    </div>
  </div>
</aside>
`;
