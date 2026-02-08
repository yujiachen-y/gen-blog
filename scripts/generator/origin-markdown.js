import path from 'node:path';
import { buildCitationMarkdown } from '../content/citation-markdown.js';
import { preprocessObsidianContent } from '../obsidian.js';
import { ensureDir, writeFile } from '../shared/fs-utils.js';
import { buildUrl, stripLeadingSlash } from '../shared/paths.js';

const formatMarkdownContent = ({ content, citation }) => {
  const normalizedContent = String(content || '').replace(/\s+$/, '');
  const normalizedCitation = String(citation || '').replace(/\s+$/, '');
  if (!normalizedCitation) {
    return `${normalizedContent}\n`;
  }
  return `${normalizedContent}\n\n${normalizedCitation}\n`;
};

export const writeOriginMarkdownFiles = async ({
  buildDir,
  originPages,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
  siteTitle,
  siteUrl,
}) =>
  Promise.all(
    originPages.map(async (post) => {
      const processedContent = await preprocessObsidianContent({
        source: post.content,
        filePath: post.sourcePath,
        imageIndex,
        inputDir,
        imageExts,
        pathExists,
        resolveImageFromIndex,
      });
      const citation = buildCitationMarkdown({
        post,
        siteTitle,
        siteUrl,
        buildUrl,
      });
      const outputPath = path.join(buildDir, stripLeadingSlash(post.markdownUrl));
      await ensureDir(path.dirname(outputPath));
      await writeFile(
        outputPath,
        formatMarkdownContent({
          content: processedContent,
          citation,
        })
      );
    })
  );
