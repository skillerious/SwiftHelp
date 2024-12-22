/********************************************************************
 * main.js
 * Electron's main process: creates BrowserWindow, sets up menus,
 * handles open/save/export, merges settings logic (recent files,
 * pinned sidebar, auto-save, etc.), plus Export to PDF.
 ********************************************************************/
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Import 'marked' for Markdown parsing
const marked = require('marked');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
      // No preload script as per your preference
    }
  });

  // Load index.html (the main editor UI)
  mainWindow.loadFile('index.html');

  // Mirror renderer logs to the terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log] ${message} (line: ${line}, source: ${sourceId})`);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open File / Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-file');
          }
        },
        {
          label: 'Save File / Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Export to HTML',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-export-html');
          }
        },
        {
          label: 'Export to PDF',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('menu-export-pdf');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
    // Additional menus can be added here (e.g., Edit, View, Help)
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  console.log('[Main] App ready...');
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Settings load/save
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.handle('load-settings', async () => {
  console.log('[Main] load-settings invoked');
  const settingsPath = path.join(__dirname, 'settings.json');

  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log('[Main] Loaded settings:', parsed);
    return parsed;
  } catch (err) {
    console.log('[Main] No valid settings.json => using defaults');
    return {
      sidebarWidth: 300,
      recentFiles: [],
      autoSave: false,
      pinnedSidebar: false
    };
  }
});

ipcMain.on('save-settings', (event, newSettings) => {
  console.log('[Main] save-settings =>', newSettings);
  const settingsPath = path.join(__dirname, 'settings.json');

  // Attempt to load existing settings to avoid overwriting unrelated fields
  let currentSettings = {
    sidebarWidth: 300,
    recentFiles: [],
    autoSave: false,
    pinnedSidebar: false
  };
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    currentSettings = JSON.parse(raw);
  } catch (e) {
    // If no existing file, defaults will be used
  }

  // Merge new settings with existing ones
  const updated = { ...currentSettings, ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Open/Save Logic for multi-sections or single-file
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('open-file-dialog', async (event) => {
  console.log('[Main] open-file-dialog triggered');
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: 'JSON or Markdown', extensions: ['json','md','markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) {
    event.reply('open-file-result', { canceled: true });
    return;
  }

  const filePath = filePaths[0];
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    // Handle multiple sections (project)
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const sectionsData = JSON.parse(raw);
      console.log('[Main] Opened .json project with', sectionsData.length, 'sections');
      event.reply('open-file-result', {
        canceled: false,
        isProject: true,
        sections: sectionsData,
        filePath
      });
    } catch (err) {
      console.log('[Main] JSON parse error:', err.message);
      event.reply('open-file-result', { canceled: true, error: 'JSON parse error' });
    }
  } else {
    // Handle single Markdown file
    const content = fs.readFileSync(filePath, 'utf-8');
    event.reply('open-file-result', {
      canceled: false,
      isProject: false,
      content,
      filePath
    });
  }
});

ipcMain.on('save-file-dialog', async (event, payload) => {
  console.log('[Main] save-file-dialog =>', payload);
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [
      { name: 'JSON or Markdown', extensions: ['json','md','markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) {
    event.reply('save-file-result', { canceled: true });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    // Save entire project (multiple sections)
    const sectionsData = payload.sections || [];
    fs.writeFileSync(filePath, JSON.stringify(sectionsData, null, 2), 'utf-8');
    event.reply('save-file-result', { canceled: false, filePath });
  } else {
    // Save single Markdown file
    const content = payload.content || '';
    fs.writeFileSync(filePath, content, 'utf-8');
    event.reply('save-file-result', { canceled: false, filePath });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Export to HTML
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('export-html', async (event, sectionsData) => {
  console.log('[Main] export-html triggered');
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (canceled || !filePath) {
    event.reply('export-html-result', { canceled: true });
    return;
  }

  try {
    const finalHtml = buildEnhancedDarkHtml(sectionsData);
    fs.writeFileSync(filePath, finalHtml, 'utf-8');
    event.reply('export-html-result', { canceled: false, filePath });
    console.log('[Main] HTML exported to:', filePath);
  } catch (err) {
    console.error('[Main] Error exporting HTML:', err);
    event.reply('export-html-result', { canceled: true, error: err.message });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Build the final HTML with center title, offcanvas open, etc.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function buildEnhancedDarkHtml(sectionsData) {
  const marked = require('marked');
  // Updated 'marked' configuration to remove deprecated options
  marked.setOptions({
    mangle: false,
    headerIds: false
    // Removed 'highlight' and 'langPrefix' to eliminate deprecation warnings
  });

  // Convert sections => HTML
  const sectionsHtml = sectionsData.map(sec => ({
    title: sec.title,
    html: marked.parse(sec.content || '')
  }));
  const stringifiedSections = JSON.stringify(sectionsHtml);

  // Read toolbar and sidebar HTML, CSS, and JS
  const toolbarHTML = fs.readFileSync(path.join(__dirname, 'toolbar.html'), 'utf-8');
  const toolbarCSS = fs.readFileSync(path.join(__dirname, 'toolbar.css'), 'utf-8');
  const toolbarJS = fs.readFileSync(path.join(__dirname, 'toolbar.js'), 'utf-8');

  const sidebarHTML = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf-8');
  const sidebarCSS = fs.readFileSync(path.join(__dirname, 'sidebar.css'), 'utf-8');
  const sidebarJS = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf-8');

  // Define inline CSS to enhance Markdown formatting and link colors
  const markdownCSS = `
    /* Styles specific to Markdown content */
    #help-content {
      padding: 1rem;
      background-color: #181818;
      height: calc(100vh - 56px);
      overflow-y: auto;
      color: #f0f0f0; /* Ensure text color inside help-content */
    }
    body.light-mode #help-content {
      background-color: #ffffff;
      color: #000000;
    }

    /* Link Styling within help-content */
    #help-content a {
      color: #66aaff; /* Preferred link color */
      text-decoration: underline;
    }
    #help-content a:hover {
      color: #5599ff;
    }

    /* Enhanced Code Blocks within help-content */
    #help-content pre {
      background-color: #2d2d2d;
      border-left: 5px solid #28a745; /* Green sidebar */
      padding: 1rem;
      border-radius: 5px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    #help-content pre code {
      background: none; /* Remove background from code */
      color: inherit; /* Inherit color from parent */
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.95em;
    }

    /* Enhanced Blockquotes within help-content */
    #help-content blockquote {
      border-left: 5px solid #ffc107; /* Yellow sidebar */
      background-color: #2a2a2a;
      padding: 0.5rem 1rem;
      margin: 1rem 0;
      border-radius: 5px;
      color: #f8f0a3;
    }
    body.light-mode #help-content blockquote {
      background-color: #fff3cd;
      border-left: 5px solid #ffc107;
      color: #856404;
    }

    /* Enhanced Tables within help-content */
    #help-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    #help-content th, #help-content td {
      border: 1px solid #555;
      padding: 0.5rem;
      text-align: left;
    }
    #help-content th {
      background-color: #343a40;
      color: #fff;
    }
    body.light-mode #help-content th {
      background-color: #007bff;
      color: #fff;
    }
    #help-content tr:nth-child(even) {
      background-color: #2d2d2d;
    }
    body.light-mode #help-content tr:nth-child(even) {
      background-color: #f2f2f2;
    }

    /* Additional Enhancements for Headings within help-content */
    #help-content h1, #help-content h2, #help-content h3, #help-content h4, #help-content h5, #help-content h6 {
      border-bottom: 2px solid #007bff;
      padding-bottom: 0.3em;
      margin-top: 1.5em;
    }
    body.light-mode #help-content h1, 
    body.light-mode #help-content h2, 
    body.light-mode #help-content h3, 
    body.light-mode #help-content h4, 
    body.light-mode #help-content h5, 
    body.light-mode #help-content h6 {
      border-bottom: 2px solid #007bff;
    }

    /* General Markdown Styling within help-content */
    #help-content p {
      line-height: 1.6;
      margin: 1rem 0;
    }
    #help-content ul, #help-content ol {
      margin: 1rem 0;
      padding-left: 2rem;
    }
    #help-content img {
      max-width: 100%;
      height: auto;
      border-radius: 5px;
    }

    /* Highlighting within help-content */
    .highlight {
      background-color: yellow; 
      color: #000; 
      font-weight: bold;
    }

    /* Inline Code Styling within help-content */
    #help-content code {
      background-color: #222; 
      padding: 2px 4px; 
      border-radius: 3px;
    }
  `;

  // Define inline JS for the exported HTML (Markdown content)
  const markdownJS = `
    let sections = ${stringifiedSections};
    let currentIndex = 0;
    let isLightMode = false;

    document.addEventListener('DOMContentLoaded', () => {
      const helpContent = document.getElementById('help-content');
      const sectionTitle = document.getElementById('currentSectionTitle');

      const btnNext = document.getElementById('btnNext');
      const btnPrev = document.getElementById('btnPrev');
      const btnHome = document.getElementById('btnHome');

      // Populate the sidebar with section titles
      sections.forEach((sec, i) => {
        const li = document.createElement('li');
        li.classList.add('section-item');
        li.textContent = sec.title;
        li.addEventListener('click', () => loadSection(i));
        document.getElementById('sections-list').appendChild(li);
      });
      loadSection(0);

      // Print functionality
      document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
      });

      // Next/Prev/Home functionality
      btnNext.addEventListener('click', () => {
        if (currentIndex < sections.length - 1) {
          loadSection(currentIndex + 1);
        }
      });
      btnPrev.addEventListener('click', () => {
        if (currentIndex > 0) {
          loadSection(currentIndex - 1);
        }
      });
      btnHome.addEventListener('click', () => {
        loadSection(0);
      });

      // Toggle dark/light mode
      document.getElementById('toggleModeBtn').addEventListener('click', () => {
        isLightMode = !isLightMode;
        document.body.classList.toggle('light-mode', isLightMode);
        const navBar = document.getElementById('mainNavbar');
        if (navBar) {
          navBar.classList.toggle('navbar-dark', !isLightMode);
          navBar.classList.toggle('navbar-light', isLightMode);
        }
      });

      function loadSection(idx) {
        currentIndex = idx;
        helpContent.innerHTML = sections[idx].html;
        if (sectionTitle) {
          sectionTitle.textContent = sections[idx].title || 'Untitled';
        }
      }

      function highlightAll(query) {
        let html = sections[currentIndex].html;
        const regex = new RegExp(query, 'gi');
        let replaced = html.replace(regex, match => '<span class="highlight">' + match + '</span>');
        helpContent.innerHTML = replaced;
      }

      // Search functionality
      document.getElementById('searchBtn').addEventListener('click', () => {
        const query = (document.getElementById('search-input').value || '').trim().toLowerCase();
        if (!query) return;
        highlightAll(query);
      });
    });
  `;

  // Return the entire HTML string with embedded toolbar, sidebar, and Markdown enhancements
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Help Docs</title>
  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <!-- Bootstrap Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
  <!-- Toolbar CSS -->
  <style>
    ${toolbarCSS}
  </style>
  <!-- Sidebar CSS -->
  <style>
    ${sidebarCSS}
  </style>
  <!-- Markdown Content CSS -->
  <style>
    ${markdownCSS}
  </style>
</head>
<body>
  <!-- Toolbar HTML -->
  ${toolbarHTML}

  <!-- Sidebar HTML -->
  ${sidebarHTML}

  <!-- Markdown Content -->
  <div id="help-content"></div>

  <!-- Toolbar JS -->
  <script>
    ${toolbarJS}
  </script>
  <!-- Sidebar JS -->
  <script>
    ${sidebarJS}
  </script>
  <!-- Markdown Content JS -->
  <script>
    ${markdownJS}
  </script>
  <!-- Bootstrap 5 Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;
}
