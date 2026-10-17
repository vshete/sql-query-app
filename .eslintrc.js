module.exports = {
  // ... your other config (extends, parser, plugins)
  rules: {
    // Spacing around block structures and statements
    "padding-line-between-statements": [
      "error",
      // 1. Force a blank line BEFORE and AFTER multi-line blocks (if, loops, try-catch)
      { blankLine: "always", prev: "multiline-block-like", next: "*" },
      { blankLine: "always", prev: "*", next: "multiline-block-like" },

      // 2. Allow consecutive if/else chains to touch WITHOUT forcing a blank line between them
      {
        blankLine: "any",
        prev: "multiline-block-like",
        next: "multiline-block-like",
      },

      // 3. Force a blank line before return statements (unless it's the only line in a block)
      { blankLine: "always", prev: "*", next: "return" },

      // 4. Force a blank line after groups of variable declarations
      { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
      {
        blankLine: "any",
        prev: ["const", "let", "var"],
        next: ["const", "let", "var"],
      },

      // 5. Force a blank line between separate directive groups (like 'use strict')
      { blankLine: "always", prev: "directive", next: "*" },
      { blankLine: "any", prev: "directive", next: "directive" },
    ],

    // Essential block padding & formatting rules
    "space-before-blocks": ["error", "always"], // Force space before opening brace: if (cond) {
    "keyword-spacing": ["error", { before: true, after: true }], // Space around keywords: } else {
    "padded-blocks": ["error", "never"], // Prevent ugly empty lines right inside the start/end of a block
    "arrow-spacing": ["error", { before: true, after: true }], // Space around arrow functions: () => {
  },
};
