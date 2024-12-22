/********************************************************************
 * main.js
 * Electron's main process: creates BrowserWindow, sets up menus,
 * handles open/save/export, merges settings logic (recent files,
 * pinned sidebar, auto-save, etc.), plus Export to PDF.
 ********************************************************************/
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load index.html (the main editor UI)
  mainWindow.loadFile('index.html');

  // Mirror renderer logs to the terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log] ${message} (line: ${line}, source: ${sourceId})`);
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
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  console.log('[Main] App ready...');
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

  // Attempt to load existing so we don't overwrite other fields
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
    // if no file, we'll create one
  }

  // Merge
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
    // multiple sections
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
    // single-file
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
    // entire project (multiple sections)
    const sectionsData = payload.sections || [];
    fs.writeFileSync(filePath, JSON.stringify(sectionsData, null, 2), 'utf-8');
    event.reply('save-file-result', { canceled: false, filePath });
  } else {
    // single .md
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

  const finalHtml = buildEnhancedDarkHtml(sectionsData);
  fs.writeFileSync(filePath, finalHtml, 'utf-8');
  event.reply('export-html-result', { canceled: false, filePath });
  console.log('[Main] HTML exported to:', filePath);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Build the final HTML with center title, offcanvas open, etc.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function buildEnhancedDarkHtml(sectionsData) {
  const marked = require('marked');
  marked.use({ mangle: false, headerIds: false });

  // Convert sections => HTML
  const sectionsHtml = sectionsData.map(sec => ({
    title: sec.title,
    html: marked.parse(sec.content || '')
  }));
  const stringifiedSections = JSON.stringify(sectionsHtml);

  // The full HTML below includes:
  // - Offcanvas sidebar
  // - Navbar with next/prev/home, print, toggle mode
  // - Searching logic, highlight, etc.
  // - Minimal styling inline for dark/light
  const inlineCSS = `
    body {
      margin: 0; padding: 0;
      font-family: system-ui, sans-serif;
      background-color: #121212;
      color: #f0f0f0;
      height: 100vh;
    }
    body.light-mode {
      background-color: #f8f9fa;
      color: #212529;
    }
    .btn-accent {
      background-color: #007bff;
      color: #fff;
      border: none;
    }
    .offcanvas-body {
      background-color: #1e1e1e;
      color: #f0f0f0;
    }
    body.light-mode .offcanvas-body {
      background-color: #f8f9fa;
      color: #212529;
    }
    #sections-list {
      list-style: none; padding-left: 0;
    }
    .section-item {
      padding: 0.75rem;
      border-bottom: 1px solid #333;
      cursor: pointer;
    }
    .section-item:hover {
      background-color: #007bff;
      color: #fff;
    }
    #help-content {
      padding: 1rem;
      background-color: #181818;
      height: calc(100vh - 56px);
      overflow-y: auto;
    }
    body.light-mode #help-content {
      background-color: #ffffff;
      color: #000000;
    }
    .highlight {
      background-color: yellow; color: #000; font-weight: bold;
    }
    code {
      background-color: #222; padding: 2px 4px; border-radius: 3px;
    }
    a {
      color: #66aaff;
    }
    /* Navbar container: left, center, right */
    .navbar-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    .navbar-left, .navbar-right {
      display: flex; align-items: center; gap: 0.5rem;
    }
    .navbar-center {
      flex: 1; display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    #currentSectionTitle {
      font-size: inherit;
      line-height: inherit;
      max-width: 250px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .title-brand {
      font-size: 1.125rem; line-height: 1.5;
    }
  `;

  const inlineJS = `
    let sections = ${stringifiedSections};
    let currentIndex = 0;
    let isLightMode = false;

    document.addEventListener('DOMContentLoaded', () => {
      const offcanvasSidebar = document.getElementById('offcanvasSidebar');
      const sectionsList = document.getElementById('sections-list');
      const helpContent = document.getElementById('help-content');
      const sectionTitle = document.getElementById('currentSectionTitle');

      const printBtn = document.getElementById('printBtn');
      const searchBtn = document.getElementById('searchBtn');
      const searchInput = document.getElementById('search-input');

      const btnNext = document.getElementById('btnNext');
      const btnPrev = document.getElementById('btnPrev');
      const btnHome = document.getElementById('btnHome');
      const toggleModeBtn = document.getElementById('toggleModeBtn');

      // Populate the sidebar with section titles
      sections.forEach((sec, i) => {
        const li = document.createElement('li');
        li.classList.add('section-item');
        li.textContent = sec.title;
        li.addEventListener('click', () => loadSection(i));
        sectionsList.appendChild(li);
      });
      loadSection(0);

      // If using Bootstrap, show offcanvas by default
      if (offcanvasSidebar && typeof bootstrap !== 'undefined') {
        const bsOffcanvas = new bootstrap.Offcanvas(offcanvasSidebar);
        bsOffcanvas.show();
      }

      // Print
      printBtn.addEventListener('click', () => {
        window.print();
      });

      // Search => highlight
      searchBtn.addEventListener('click', () => {
        const query = (searchInput.value || '').trim();
        if (!query) return;
        highlightAll(query.toLowerCase());
      });

      // Next/Prev/Home
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
      toggleModeBtn.addEventListener('click', () => {
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
    });
  `;

  // Return the entire HTML string
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
  <style>${inlineCSS}</style>
</head>
<body>
  <nav class="navbar navbar-dark sticky-top px-3" id="mainNavbar">
    <div class="navbar-container w-100">
      <!-- Left: hamburger + 'Help Docs' -->
      <div class="navbar-left">
        <button class="navbar-toggler btn-accent me-2" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasSidebar" aria-controls="offcanvasSidebar">
          <i class="bi bi-list"></i>
        </button>
        <span class="navbar-brand mb-0 title-brand">Help Docs</span>
      </div>
      <!-- Center: current section title -->
      <div class="navbar-center">
        <span id="currentSectionTitle" class="navbar-brand mb-0 title-brand"></span>
      </div>
      <!-- Right: next/prev/home, print, toggle -->
      <div class="navbar-right">
        <button class="btn btn-accent" id="btnPrev" title="Previous Section">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button class="btn btn-accent" id="btnHome" title="Home (First Section)">
          <i class="bi bi-house-door-fill"></i>
        </button>
        <button class="btn btn-accent" id="btnNext" title="Next Section">
          <i class="bi bi-chevron-right"></i>
        </button>
        <button class="btn btn-accent" id="printBtn" title="Print">
          <i class="bi bi-printer"></i>
        </button>
        <button class="btn btn-accent" id="toggleModeBtn" title="Dark/Light Toggle">
          <i class="bi bi-lightbulb"></i>
        </button>
      </div>
    </div>
  </nav>

  <!-- Offcanvas sidebar -->
  <div class="offcanvas offcanvas-start text-light" tabindex="-1" id="offcanvasSidebar" aria-labelledby="offcanvasSidebarLabel" style="background-color:#1e1e1e;">
    <div class="offcanvas-header border-bottom">
      <h5 class="offcanvas-title" id="offcanvasSidebarLabel">Sections</h5>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body">
      <ul id="sections-list"></ul>
      <div class="input-group mb-3">
        <input type="text" class="form-control form-control-dark" id="search-input" placeholder="Search..."/>
        <button class="btn btn-accent" type="button" id="searchBtn">
          <i class="bi bi-search"></i>
        </button>
      </div>
    </div>
  </div>

  <div id="help-content"></div>

  <!-- Bootstrap 5 Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>${inlineJS}</script>
</body>
</html>
  `;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Export to PDF
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('menu-export-pdf', async () => {
  console.log('[Main] menu-export-pdf => triggered');
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) {
    return;
  }

  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      landscape: false,
      marginsType: 0,
      printBackground: true,
      pageSize: 'A4'
    });
    fs.writeFileSync(filePath, pdfData);
    console.log('[Main] PDF exported to:', filePath);
    mainWindow.webContents.send('export-pdf-result', { filePath });
  } catch (err) {
    console.error('[Main] printToPDF error:', err);
    mainWindow.webContents.send('export-pdf-result', { error: err.message });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Recent Files Logic
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('update-recent-files', (event, filePath) => {
  console.log('[Main] update-recent-files =>', filePath);

  const settingsPath = path.join(__dirname, 'settings.json');
  let settings = {
    sidebarWidth: 300,
    recentFiles: [],
    autoSave: false,
    pinnedSidebar: false
  };
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    settings = JSON.parse(raw);
  } catch(e) {
    // no existing file, use defaults
  }

  // Insert or bump file to front
  const idx = settings.recentFiles.indexOf(filePath);
  if (idx !== -1) {
    settings.recentFiles.splice(idx, 1);
  }
  settings.recentFiles.unshift(filePath);

  // limit to 5
  if (settings.recentFiles.length > 5) {
    settings.recentFiles.pop();
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  event.reply('recent-files-updated', settings.recentFiles);
});
