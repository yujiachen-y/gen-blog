module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['sonarjs'],
  rules: {
    'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 70, skipBlankLines: true, skipComments: true }],
    complexity: ['error', 10],
    'max-depth': ['error', 4],
    'max-statements': ['error', 40],
    'sonarjs/no-identical-functions': 'error',
  },
  extends: ['eslint:recommended'],
  overrides: [
    {
      files: ['theme/app.js', 'theme/app/**/*.js'],
      env: {
        browser: true,
      },
    },
    {
      files: [
        'scripts/generate.js',
        'scripts/content/content.js',
        'scripts/content/markdown-renderer.js',
        'theme/app/comments.js',
        'theme/app/filters.js',
      ],
      rules: {
        'max-lines': ['error', { max: 850, skipBlankLines: true, skipComments: true }],
        'max-lines-per-function': ['error', { max: 180, skipBlankLines: true, skipComments: true }],
        'max-statements': ['error', 180],
      },
    },
  ],
};
