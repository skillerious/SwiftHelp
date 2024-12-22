const fs = require('fs');
const path = require('path');
const marked = require('marked');

// 1) Read the user’s markdown (for demo, we just read markdown-sample.md)
const mdFile = path.join(__dirname, 'markdown-sample.md');
const markdownContent = fs.readFileSync(mdFile, 'utf8');

// 2) Convert to HTML
const compiledHTML = marked.parse(markdownContent);

// 3) Build final HTML content
// We embed minimal CSS/JS. You might want to reference an external .css for large styling.
const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Help Documentation</title>
  <style>
    body {
      margin: 0; padding: 0;
      font-family: sans-serif;
      background: #f0f0f0; color: #333;
    }
    #container {
      display: flex;
      height: 100vh;
    }
    #sidebar {
      width: 250px;
      background: #222;
      color: #fff;
      padding: 10px;
    }
    #content {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      background: #fff;
      color: #000;
    }
    h1, h2, h3, h4 {
      margin: 1em 0 0.5em 0;
    }
    a { color: blue; }
    /* More styling as needed */
  </style>
</head>
<body>
  <div id="container">
    <div id="sidebar">
      <h2>Table of Contents</h2>
      <!-- In a real multi-section approach, you'd generate a list of sections. -->
      <p>Single Markdown File Export</p>
    </div>
    <div id="content">
      ${compiledHTML}
    </div>
  </div>
</body>
</html>
`;

// 4) Write to help.html (in the project root or dist folder)
const outputPath = path.join(__dirname, 'help.html');
fs.writeFileSync(outputPath, finalHtml, 'utf8');

console.log(`[Export HTML] Successfully created: ${outputPath}`);
