module.exports = {
  '**/*.{js,mjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '**/*.{json,css}': ['prettier --write'],
};
