module.exports = {
  // TypeScript and JavaScript files
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],

  // JSON files
  '*.json': ['prettier --write'],

  // CSS and SCSS files
  '*.{css,scss,sass}': ['prettier --write'],

  // Markdown files
  '*.md': ['prettier --write'],

  // Other files that Prettier can handle
  '*.{html,yaml,yml}': ['prettier --write'],
};
