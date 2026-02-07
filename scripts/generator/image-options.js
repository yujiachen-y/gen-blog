import path from 'node:path';

export const createImageOptions = ({ buildDir, inputDir }) => {
  const shared = {
    outputBase: path.join(buildDir, 'assets'),
    sourceBase: inputDir,
    publicBase: '/assets',
  };

  return {
    inlineImageOptions: {
      ...shared,
      maxWidth: 1080,
      minWidth: 320,
      maxBytes: 1536 * 1024,
      jpegQuality: 82,
      webpQuality: 82,
    },
    coverImageOptions: {
      ...shared,
      maxWidth: 1920,
      minWidth: 320,
      maxBytes: 2048 * 1024,
      jpegQuality: 82,
      webpQuality: 82,
    },
  };
};
