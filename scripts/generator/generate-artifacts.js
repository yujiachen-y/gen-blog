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

export const collectPostArtifacts = (posts) =>
  posts.flatMap((post) =>
    (post.artifacts || []).map((artifact) => ({
      post,
      artifact,
      sourcePath: resolveArtifactSource({ post, artifact }),
    }))
  );

export const validateArtifactUrls = ({ postPages, artifacts }) => {
  const taken = new Map();
  postPages.forEach((post) => {
    taken.set(post.url, `post "${post.translationKey}"`);
  });
  artifacts.forEach(({ post, artifact }) => {
    const existing = taken.get(artifact.url);
    if (existing) {
      throw new Error(
        `blog_artifacts url collision: ${artifact.url} from ${post.sourcePath} conflicts with ${existing}`
      );
    }
    taken.set(artifact.url, `artifact from ${post.sourcePath}`);
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
