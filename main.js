
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const marked = require('marked');

// We'll store if user has unsaved changes globally
let globalIsDirty = false;

let mainWindow;
let settingsWindow = null; // reference to optional settings window

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

  // Immediately maximize after creation
  mainWindow.maximize();

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log] ${message} (line: ${line}, source: ${sourceId})`);
  });

  // Instead of will-prevent-unload, handle close event directly
  mainWindow.on('close', (e) => {
    if (globalIsDirty) {
      const choice = dialog.showMessageBoxSync({
        type: 'question',
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Discard or Cancel?',
        buttons: [
          'Discard', // index 0 => close
          'Cancel'   // index 1 => stay open
        ],
        defaultId: 1, // highlight "Cancel"
        cancelId: 1
      });
      // If user picks index 1 => "Cancel", prevent closing
      if (choice === 1) {
        e.preventDefault();
      }
    }
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
              console.log('[Main] Asking renderer for sectionsData...');
              const sectionsData = await mainWindow.webContents.executeJavaScript('window.getCurrentSectionsData()');
              if (!sectionsData) {
                console.log('[Main] No sectionsData returned for preview in browser.');
                return;
              }
              console.log('[Main] sectionsData obtained. Sending preview-in-browser...');
              previewInBrowser(sectionsData);
            } catch (err) {
              console.log('[Main] Error retrieving sectionsData for preview:', err);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://yoursite.example.com/docs');
          }
        },
        {
          label: 'About SwiftHelp',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About SwiftHelp',
              message: 'SwiftHelp v1.0 - A Help Authoring Tool powered by Electron'
            });
          }
        }
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Optional settings window
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('open-settings', () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'SwiftHelp Settings',
    backgroundColor: '#fafafa',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
});

ipcMain.handle('get-app-settings', async () => {
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
  } catch (e) { /* ignore */ }
  return currentSettings;
});

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
  } catch (e) { /* ignore */ }
  const merged = { ...currentSettings, ...updated };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log('[Main] Updated app settings =>', merged);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// The older load/save settings approach
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.handle('load-settings', async () => {
  console.log('[Main] load-settings invoked');
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
  } catch (e) {}
  const updated = { ...currentSettings, ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Listen for the renderer's "update-is-dirty"
ipcMain.on('update-is-dirty', (event, newDirtyState) => {
  globalIsDirty = newDirtyState;
  console.log('[Main] globalIsDirty updated =>', globalIsDirty);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Open / Save logic
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
// Export to HTML
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('export-html', async (event, payload) => {
  let sectionsData = [];
  let userDocTitle = '';

  if (Array.isArray(payload)) {
    sectionsData = payload; // old approach, no docTitle
  } else if (payload && typeof payload === 'object') {
    sectionsData = payload.sectionsData || [];
    userDocTitle = payload.docTitle || '';
  }
  console.log('[Main] export-html triggered, docTitle=', userDocTitle);

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
    console.log('[Main] previewInBrowser => building HTML for preview...');
    const finalHtml = buildEnhancedDarkHtml(sectionsData, 'SwiftHelp Preview');
    const tmpFile = path.join(os.tmpdir(), `swifthelp-preview-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, finalHtml, 'utf8');
    console.log('[Main] Opening preview =>', tmpFile);
    await shell.openExternal('file://' + tmpFile);
  } catch (err) {
    console.error('[Main] previewInBrowser error:', err);
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Build final HTML with docTitle => replaced in Dark-Template.html
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

  const templatePath = path.join(__dirname, 'templates', 'Dark-Template.html');
  let templateString = fs.readFileSync(templatePath, 'utf-8');

  // Build dynamic JS to load sections, etc.
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

  const usedDocTitle = docTitle.trim() || 'SwiftHelp Export';
  const initialTitle = renderedSections.length ? renderedSections[0].title : 'Untitled';
  const initialHtml  = renderedSections.length ? renderedSections[0].html   : '<p>No content</p>';

  templateString = templateString
    .replace(/{{ docTitle }}/g, usedDocTitle)
    .replace(/{{ initial_section_title }}/g, initialTitle)
    .replace(/{{ initial_content }}/g, initialHtml)
    .replace(/{{ sidebar_content }}/g, sidebarHtml)
    .replace(/{{ dynamic_js_block }}/g, dynamicJsBlock);

  console.log('[Main] buildEnhancedDarkHtml => docTitle replaced =>', usedDocTitle);
  return templateString;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// PDF placeholder
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.on('menu-export-pdf', async () => {
  console.log('[Main] Export to PDF triggered');
  // placeholder logic or PDF generation can go here
});
