/********************************************************************
 * main.js
 * Electron's main process: creates BrowserWindow, sets up menus,
 * handles open/save/export, merges settings logic (recent files,
 * pinned sidebar, auto-save, etc.).
 *
 * Now includes:
 *   - open-settings => spawns settings.html
 *   - get-app-settings / save-app-settings
 *   - docTitle support in buildEnhancedDarkHtml()
 ********************************************************************/
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const marked = require('marked');

let mainWindow;
let settingsWindow = null; // We'll store reference to settings window

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

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log] ${message} (line: ${line}, source: ${sourceId})`);
  });

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
            // For docTitle, you might do:
            // mainWindow.webContents.send('menu-export-html', { docTitle: 'Custom Title' });
            // Or just the simpler approach:
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
        {
          label: 'Preview in Browser',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: async () => {
            try {
              const sectionsData = await mainWindow.webContents.executeJavaScript('window.getCurrentSectionsData()');
              if (!sectionsData) {
                console.log('[Main] No sectionsData returned for preview in browser.');
                return;
              }
              previewInBrowser(sectionsData);
            } catch (err) {
              console.log('[Main] Error retrieving sectionsData for preview:', err);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
    // Additional menus if needed...
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  console.log('[Main] App ready...');
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// "open-settings" => spawn a settings.html window
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('open-settings', () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'SwiftHelp Settings',
    backgroundColor: '#fafafa',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
});

// Provide app settings to settings.html
ipcMain.handle('get-app-settings', async () => {
  const settingsPath = path.join(__dirname, 'settings.json');
  let currentSettings = {
    sidebarWidth: 300,
    recentFiles: [],
    autoSave: false,
    pinnedSidebar: false,
    lightMode: false // or other fields
  };
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    currentSettings = JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return currentSettings;
});

// Save updated settings from settings.html
ipcMain.on('save-app-settings', (event, updated) => {
  const settingsPath = path.join(__dirname, 'settings.json');
  let currentSettings = {
    sidebarWidth: 300,
    recentFiles: [],
    autoSave: false,
    pinnedSidebar: false,
    lightMode: false
  };
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    currentSettings = JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  const merged = { ...currentSettings, ...updated };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log('[Main] Updated app settings =>', merged);

  // Optionally, broadcast to mainWindow
  // mainWindow.webContents.send('settings-updated', merged);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Settings load/save used by the main editor
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.handle('load-settings', async () => {
  console.log('[Main] load-settings invoked (legacy approach)');
  const settingsPath = path.join(__dirname, 'settings.json');
  let parsed = {
    sidebarWidth: 300,
    recentFiles: [],
    autoSave: false,
    pinnedSidebar: false
  };
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    parsed = JSON.parse(raw);
    console.log('[Main] Loaded settings:', parsed);
  } catch (err) {
    console.log('[Main] No valid settings.json => using defaults');
  }
  return parsed;
});

ipcMain.on('save-settings', (event, newSettings) => {
  console.log('[Main] save-settings =>', newSettings);
  const settingsPath = path.join(__dirname, 'settings.json');

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
    // If no existing file
  }
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
    // single .md
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
    // multiple => .json
    const sectionsData = payload.sections || [];
    fs.writeFileSync(filePath, JSON.stringify(sectionsData, null, 2), 'utf-8');
    event.reply('save-file-result', { canceled: false, filePath });
  } else {
    // single => .md
    const content = payload.content || '';
    fs.writeFileSync(filePath, content, 'utf-8');
    event.reply('save-file-result', { canceled: false, filePath });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Export to HTML (with optional docTitle from payload)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('export-html', async (event, payload) => {
  // payload can be either just sections or { sections, docTitle }
  const sectionsData = Array.isArray(payload) ? payload : payload.sections;
  const userDocTitle = (Array.isArray(payload) ? null : payload.docTitle) || '';

  console.log('[Main] export-html triggered');
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (canceled || !filePath) {
    event.reply('export-html-result', { canceled: true });
    return;
  }

  try {
    const finalHtml = buildEnhancedDarkHtml(sectionsData, userDocTitle);
    fs.writeFileSync(filePath, finalHtml, 'utf-8');
    event.reply('export-html-result', { canceled: false, filePath });
    console.log('[Main] HTML exported to:', filePath);
  } catch (err) {
    console.error('[Main] Error exporting HTML:', err);
    event.reply('export-html-result', { canceled: true, error: err.message });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// "Preview in Browser" => Export to a temp file & open
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('preview-in-browser', (event, sectionsData) => {
  previewInBrowser(sectionsData);
});

async function previewInBrowser(sectionsData) {
  try {
    const finalHtml = buildEnhancedDarkHtml(sectionsData);
    const tmpFile = path.join(os.tmpdir(), `swifthelp-preview-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, finalHtml, 'utf8');
    await shell.openExternal('file://' + tmpFile);
    console.log('[Main] Preview launched in browser =>', tmpFile);
  } catch (err) {
    console.error('[Main] previewInBrowser error:', err);
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Build the final HTML from sectionsData + optional docTitle
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function buildEnhancedDarkHtml(sectionsData, docTitle = '') {
  marked.setOptions({ mangle: false, headerIds: false });
  const renderedSections = sectionsData.map(sec => ({
    title: sec.title,
    html: marked.parse(sec.content || '')
  }));

  const sidebarHtml = renderedSections
    .map(sec => `<li class="section-item">${sec.title}</li>`)
    .join('\n');

  // read Dark-Template.html
  const templatePath = path.join(__dirname, 'templates', 'Dark-Template.html');
  let templateString = fs.readFileSync(templatePath, 'utf-8');

  // dynamic block for prev/home/next/print/toggle mode
  const dynamicJsBlock = `
    const sections = ${JSON.stringify(renderedSections, null, 2)};
    let currentIndex = 0;

    document.addEventListener('DOMContentLoaded', () => {
      function loadSection(idx) {
        if (idx < 0 || idx >= sections.length) return;
        currentIndex = idx;
        document.getElementById('help-content').innerHTML = sections[idx].html;
        const titleEl = document.getElementById('currentSectionTitle');
        if (titleEl) {
          titleEl.textContent = sections[idx].title;
        }
      }

      const sidebarItems = document.querySelectorAll('#sections-list .section-item');
      sidebarItems.forEach((item, i) => {
        item.addEventListener('click', () => loadSection(i));
      });

      loadSection(0);

      const btnPrev = document.getElementById('btnPrev');
      const btnHome = document.getElementById('btnHome');
      const btnNext = document.getElementById('btnNext');
      const printBtn = document.getElementById('printBtn');
      const toggleModeBtn = document.getElementById('toggleModeBtn');

      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          if (currentIndex > 0) loadSection(currentIndex - 1);
        });
      }
      if (btnHome) {
        btnHome.addEventListener('click', () => {
          loadSection(0);
        });
      }
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (currentIndex < sections.length - 1) loadSection(currentIndex + 1);
        });
      }
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          window.print();
        });
      }

      let isLightMode = false;
      if (toggleModeBtn) {
        toggleModeBtn.addEventListener('click', () => {
          isLightMode = !isLightMode;
          document.body.classList.toggle('light-mode', isLightMode);
        });
      }
    });
  `;

  // If user passed docTitle, use it; otherwise default
  const usedDocTitle = docTitle.trim() || 'SwiftHelp Export';
  const initialTitle = renderedSections.length ? renderedSections[0].title : 'Untitled';
  const initialHtml = renderedSections.length ? renderedSections[0].html : '<p>No content</p>';

  // Replace placeholders
  templateString = templateString
    .replace('{{ docTitle }}', usedDocTitle)
    .replace('{{ initial_section_title }}', initialTitle)
    .replace('{{ initial_content }}', initialHtml)
    .replace('{{ sidebar_content }}', sidebarHtml)
    .replace('{{ dynamic_js_block }}', dynamicJsBlock);

  return templateString;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Export to PDF (placeholder logic)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('menu-export-pdf', async () => {
  console.log('[Main] Export to PDF triggered');
  // For future PDF logic
});
