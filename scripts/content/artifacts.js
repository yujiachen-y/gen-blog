import { escapeHtml } from '../shared/templates.js';

const ARTIFACT_DEFAULT_LABELS = {
  slides: { zh: '打开演示稿', en: 'Open slides' },
  demo: { zh: '打开互动演示', en: 'Open demo' },
  notebook: { zh: '打开 notebook', en: 'Open notebook' },
  playground: { zh: '打开 playground', en: 'Open playground' },
};

const ARTIFACT_FALLBACK_LABEL = { zh: '打开附件', en: 'Open artifact' };

const resolveArtifactLabel = (artifact, lang) => {
  if (artifact.label) {
    return artifact.label;
  }
  const langKey = lang === 'zh' ? 'zh' : 'en';
  return (ARTIFACT_DEFAULT_LABELS[artifact.type] || ARTIFACT_FALLBACK_LABEL)[langKey];
};

export const buildArtifactBannerHtml = (post) => {
  const artifacts = Array.isArray(post.artifacts) ? post.artifacts : [];
  if (artifacts.length === 0) {
    return '';
  }
  const items = artifacts
    .map((artifact) => {
      const label = resolveArtifactLabel(artifact, post.lang);
      return `\n    <a class="article-artifact article-artifact-${escapeHtml(artifact.type)}" href="${escapeHtml(
        artifact.url
      )}"><span class="article-artifact-label">${escapeHtml(
        label
      )}</span><span class="article-artifact-arrow" aria-hidden="true">→</span></a>`;
    })
    .join('');
  return `\n  <div class="article-artifacts">${items}\n  </div>`;
};
