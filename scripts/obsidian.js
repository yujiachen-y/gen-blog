import {
  convertHtmlAsidesToCallouts,
  stripObsidianComments,
  stripObsidianDeletions,
} from './obsidian/cleanup.js';
import { replaceObsidianImageEmbeds } from './obsidian/embeds.js';

export const preprocessObsidianContent = async ({
  source,
  filePath,
  imageIndex,
  inputDir,
  imageExts,
  pathExists,
  resolveImageFromIndex,
}) => {
  const withAsides = convertHtmlAsidesToCallouts(source);
  const stripped = stripObsidianComments(withAsides);
  const cleaned = stripObsidianDeletions(stripped);
  return replaceObsidianImageEmbeds({
    source: cleaned,
    filePath,
    imageIndex,
    inputDir,
    imageExts,
    pathExists,
    resolveImageFromIndex,
  });
};
