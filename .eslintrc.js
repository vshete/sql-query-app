module.exports = {
  // ... your other config (extends, parser, plugins)
  rules: {
    // Require a blank line after every block-like statement (like 'if' blocks, loops, etc.)
    "padding-line-between-statements": [
      "error",
      // Always require a blank line after 'if' blocks
      { blankLine: "always", prev: "block-like", next: "*" },
      { blankLine: "always", prev: "*", next: "block-like" },

      // Always require a blank line between function declarations
      { blankLine: "always", prev: "function", next: "function" },

      // Always require a blank line before return statements
      { blankLine: "always", prev: "*", next: "return" },

      // Always require a blank line after variable declarations (const, let, var)
      { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
      {
        blankLine: "any",
        prev: ["const", "let", "var"],
        next: ["const", "let", "var"],
      },
    ],
  },
};
