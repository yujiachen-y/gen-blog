module.exports = {
  '**/*.{js,cjs,mjs}': ['eslint --fix', 'prettier --write'],
  '**/*.{json,css}': ['prettier --write'],
};
