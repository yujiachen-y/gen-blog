import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, pathExists } from '../shared/fs-utils.js';
import { stripLeadingSlash } from '../shared/paths.js';

const copyRecursive = async (src, dest) => {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await ensureDir(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });
    await Promise.all(
      entries.map((entry) => copyRecursive(path.join(src, entry.name), path.join(dest, entry.name)))
    );
    return;
  }
  if (stat.isFile()) {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
  }
};

const resolveArtifactSource = ({ post, artifact }) =>
  path.resolve(path.dirname(post.sourcePath), artifact.source);

const collectRawArtifacts = (posts) =>
  posts.flatMap((post) =>
    (post.artifacts || []).map((artifact) => ({
      post,
      artifact,
      sourcePath: resolveArtifactSource({ post, artifact }),
    }))
  );

const mergeArtifactIntoMap = (byUrl, entry) => {
  const existing = byUrl.get(entry.artifact.url);
  if (!existing) {
    byUrl.set(entry.artifact.url, entry);
    return;
  }
  if (existing.post.translationKey !== entry.post.translationKey) {
    throw new Error(
      `blog_artifacts url collision: ${entry.artifact.url} is shared between posts "${existing.post.translationKey}" and "${entry.post.translationKey}"`
    );
  }
  if (existing.sourcePath !== entry.sourcePath) {
    throw new Error(
      `blog_artifacts source mismatch: ${entry.artifact.url} resolves to different sources across translations of "${entry.post.translationKey}" (${existing.sourcePath} vs ${entry.sourcePath})`
    );
  }
};

export const collectPostArtifacts = (posts) => {
  const byUrl = new Map();
  collectRawArtifacts(posts).forEach((entry) => mergeArtifactIntoMap(byUrl, entry));
  return Array.from(byUrl.values());
};

export const validateArtifactUrls = ({ postPages, artifacts }) => {
  const postUrls = new Map(postPages.map((post) => [post.url, post.translationKey]));
  artifacts.forEach(({ post, artifact }) => {
    const conflictingPostKey = postUrls.get(artifact.url);
    if (conflictingPostKey) {
      throw new Error(
        `blog_artifacts url collision: ${artifact.url} from ${post.sourcePath} conflicts with post "${conflictingPostKey}"`
      );
    }
  });
};

export const writeArtifacts = async ({ artifacts, buildDir }) =>
  Promise.all(
    artifacts.map(async ({ post, artifact, sourcePath }) => {
      if (!(await pathExists(sourcePath))) {
        throw new Error(`${post.sourcePath}: blog_artifacts source not found: ${sourcePath}`);
      }
      const targetPath = path.join(buildDir, stripLeadingSlash(artifact.url));
      await copyRecursive(sourcePath, targetPath);
    })
  );
