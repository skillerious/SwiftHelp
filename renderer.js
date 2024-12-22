/********************************************************************
 * renderer.js
 * Runs in the browser window. Implements multi-section editing,
 * auto-save, pinned sidebar, recent files overlay, syntax highlighting
 * for code blocks, plus the new PDF export.
 ********************************************************************/
console.log('[Renderer] renderer.js loaded');

const { ipcRenderer } = require('electron');
const path = require('path');
const marked = require('marked');

// We want code highlighting. We'll define a custom renderer that uses highlight.js.
marked.setOptions({
  highlight: function (code, lang) {
    // If we have highlight.js loaded, we can do:
    if (window.hljs) {
      if (lang && window.hljs.getLanguage(lang)) {
        return window.hljs.highlight(code, { language: lang }).value;
      }
      return window.hljs.highlightAuto(code).value;
    }
    // Fallback if highlight.js isn't loaded:
    return code;
  }
});

marked.use({ mangle: false, headerIds: false });

// An array of sections
let sections = [
  { title: 'Introduction', content: '# Introduction\n\nHello world!' }
];
let currentSectionIndex = 0;
let currentFilePath = null;
let isProjectFile = false;

// We'll store user-chosen widths in settings.json
let sidebarWidth = 300; // default
let autoSave = false;
let pinnedSidebar = false;
let recentFiles = [];

// Auto-save helper
let autoSaveTimer = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds after last edit

// Grab references
const previewContent = document.getElementById('preview-content');
const markdownEditor = document.getElementById('markdown-editor');
const sectionsList = document.getElementById('sections-list');
const sidebarContainer = document.getElementById('sidebar-container');
const verticalSplitter = document.getElementById('vertical-splitter');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');

// Main toolbar
const btnNew = document.getElementById('btn-new');
const btnOpen = document.getElementById('btn-open');
const btnSave = document.getElementById('btn-save');
const btnExportHtml = document.getElementById('btn-export-html');
const btnExportPdf = document.getElementById('btn-export-pdf'); // new
const toggleTheme = document.getElementById('toggle-theme');

// Additional features
const btnAddSection = document.getElementById('btn-add-section');
const btnSearch = document.getElementById('btn-search');
const btnReplace = document.getElementById('btn-replace');
const searchInput = document.getElementById('search-input');
const replaceInput = document.getElementById('replace-input');

const btnBold = document.getElementById('btn-bold');
const btnItalic = document.getElementById('btn-italic');
const btnUnderline = document.getElementById('btn-underline');
const btnBulletList = document.getElementById('btn-bullet-list');
const btnNumberList = document.getElementById('btn-number-list');
const btnInlineCode = document.getElementById('btn-inline-code');

const btnInsertImg = document.getElementById('btn-insert-img');
const btnInsertLink = document.getElementById('btn-insert-link');
const btnInsertTable = document.getElementById('btn-insert-table');
const btnInsertCode = document.getElementById('btn-insert-code');
const btnSpellcheck = document.getElementById('btn-spellcheck');

// Advanced features
const btnRecentFiles = document.getElementById('btn-recent-files');
const chkAutoSave = document.getElementById('chk-auto-save');
const btnPinSidebar = document.getElementById('btn-pin-sidebar');

// Overlays
const ctxMenu = document.getElementById('section-context-menu');
const ctxRename = document.getElementById('ctx-rename');
const ctxDuplicate = document.getElementById('ctx-duplicate');
const ctxDelete = document.getElementById('ctx-delete');
let contextSectionIndex = null;

const renameOverlay = document.getElementById('rename-overlay');
const renameInput = document.getElementById('rename-input');
const renameSave = document.getElementById('rename-save');
const renameCancel = document.getElementById('rename-cancel');

const recentFilesOverlay = document.getElementById('recent-files-overlay');
const recentFilesContent = document.getElementById('recent-files-content');
const recentFilesList = document.getElementById('recent-files-list');
const closeRecent = document.getElementById('close-recent');

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// init() => load settings from main
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function init() {
  console.log('[Renderer] init() => loading settings from main');
  ipcRenderer.invoke('load-settings')
    .then((settings) => {
      if (settings.sidebarWidth) sidebarWidth = settings.sidebarWidth;
      if (Array.isArray(settings.recentFiles)) recentFiles = settings.recentFiles;
      if (typeof settings.autoSave === 'boolean') autoSave = settings.autoSave;
      if (typeof settings.pinnedSidebar === 'boolean') pinnedSidebar = settings.pinnedSidebar;

      applySidebarWidth();
      applyPinnedSidebar();
      chkAutoSave.checked = autoSave;
    })
    .catch((err) => {
      console.log('[Renderer] load-settings error:', err);
    })
    .finally(() => {
      // load default section
      markdownEditor.value = sections[currentSectionIndex].content;
      renderMarkdown();
      updateSectionsList();
    });
}
init();

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// applySidebarWidth => sets the sidebarContainer width
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function applySidebarWidth() {
  sidebarContainer.style.width = sidebarWidth + 'px';
}

// If pinned, add a 'pinned' class to #main-split-container
function applyPinnedSidebar() {
  const splitContainer = document.getElementById('main-split-container');
  if (pinnedSidebar) {
    splitContainer.classList.add('pinned');
  } else {
    splitContainer.classList.remove('pinned');
  }
}

function renderMarkdown() {
  const raw = sections[currentSectionIndex].content || '';
  const html = marked.parse(raw);
  previewContent.innerHTML = html;

  // Attempt to highlight code blocks if highlight.js loaded
  if (window.hljs) {
    const codeBlocks = previewContent.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      window.hljs.highlightBlock(block);
    });
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Update sections list
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function updateSectionsList() {
  sectionsList.innerHTML = '';
  sections.forEach((section, idx) => {
    const li = document.createElement('li');
    li.classList.add('section-item');
    if (idx === currentSectionIndex) {
      li.classList.add('active');
    }

    // Title
    const titleSpan = document.createElement('span');
    titleSpan.textContent = section.title;
    titleSpan.style.cursor = 'pointer';
    titleSpan.addEventListener('click', () => {
      currentSectionIndex = idx;
      markdownEditor.value = section.content;
      updateSectionsList();
      renderMarkdown();
    });

    // Up arrow
    const upBtn = document.createElement('button');
    upBtn.textContent = '▲';
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx > 0) {
        const temp = sections[idx];
        sections[idx] = sections[idx - 1];
        sections[idx - 1] = temp;
        if (currentSectionIndex === idx) currentSectionIndex--;
        updateSectionsList();
        renderMarkdown();
      }
    });

    // Down arrow
    const downBtn = document.createElement('button');
    downBtn.textContent = '▼';
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx < sections.length - 1) {
        const temp = sections[idx];
        sections[idx] = sections[idx + 1];
        sections[idx + 1] = temp;
        if (currentSectionIndex === idx) currentSectionIndex++;
        updateSectionsList();
        renderMarkdown();
      }
    });

    // Right-click => context menu
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextSectionIndex = idx;
      ctxMenu.style.left = e.pageX + 'px';
      ctxMenu.style.top = e.pageY + 'px';
      ctxMenu.style.display = 'flex';
    });

    li.appendChild(titleSpan);
    li.appendChild(upBtn);
    li.appendChild(downBtn);
    sectionsList.appendChild(li);
  });
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Editor changes => re-render preview (and maybe auto-save)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
markdownEditor.addEventListener('input', () => {
  sections[currentSectionIndex].content = markdownEditor.value;
  renderMarkdown();

  if (autoSave) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      tryAutoSave();
    }, AUTO_SAVE_DELAY);
  }
});

function tryAutoSave() {
  // We only auto-save if we have an actual file path or project
  if (!currentFilePath) {
    console.log('[Renderer] Auto-save skipped - no file path yet');
    return;
  }
  console.log('[Renderer] Auto-saving...');
  if (sections.length > 1) {
    // multiple => .json
    ipcRenderer.send('save-file-dialog', {
      isProject: true,
      sections
    });
  } else {
    // single => .md
    ipcRenderer.send('save-file-dialog', {
      isProject: false,
      content: sections[0].content
    });
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Add section
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
btnAddSection.addEventListener('click', () => {
  const newTitle = `Section ${sections.length + 1}`;
  sections.push({ title: newTitle, content: '' });
  currentSectionIndex = sections.length - 1;
  markdownEditor.value = '';
  renderMarkdown();
  updateSectionsList();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Search & Replace (improved: highlight all matches in current section)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
btnSearch.addEventListener('click', () => {
  const searchTerm = searchInput.value.trim();
  if (!searchTerm) return;

  // We'll highlight all matches in the *current* section
  let content = sections[currentSectionIndex].content;
  const regex = new RegExp(searchTerm, 'gi');
  const replaced = content.replace(regex, (match) => {
    return `<<HIGHLIGHT>>${match}<<ENDHIGHLIGHT>>`;
  });

  // Temporarily store the replaced text
  sections[currentSectionIndex].content = replaced;
  renderMarkdown();

  // In the rendered HTML, replace those placeholders with a highlight span
  const rawHTML = previewContent.innerHTML;
  const finalHTML = rawHTML.replace(/<<HIGHLIGHT>>(.*?)<<ENDHIGHLIGHT>>/g, (m, group1) => {
    return `<span class="highlight">${group1}</span>`;
  });
  previewContent.innerHTML = finalHTML;

  // revert
  sections[currentSectionIndex].content = content;
});

btnReplace.addEventListener('click', () => {
  const sTerm = searchInput.value;
  const rTerm = replaceInput.value;
  if (!sTerm) return;
  const oldContent = sections[currentSectionIndex].content || '';
  const newContent = oldContent.replaceAll(sTerm, rTerm);
  sections[currentSectionIndex].content = newContent;
  markdownEditor.value = newContent;
  renderMarkdown();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Insert formatting: bold, italic, underline, etc.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function insertIntoEditor(mdText) {
  const start = markdownEditor.selectionStart;
  const end = markdownEditor.selectionEnd;
  const val = markdownEditor.value;
  markdownEditor.value = val.substring(0, start) + mdText + val.substring(end);
  sections[currentSectionIndex].content = markdownEditor.value;
  renderMarkdown();
}

btnBold?.addEventListener('click', () => { insertIntoEditor('**Bold**'); });
btnItalic?.addEventListener('click', () => { insertIntoEditor('_Italic_'); });
btnUnderline?.addEventListener('click', () => { insertIntoEditor('<u>Underline</u>'); });
btnBulletList?.addEventListener('click', () => {
  insertIntoEditor('- Item 1\n- Item 2\n- Item 3\n');
});
btnNumberList?.addEventListener('click', () => {
  insertIntoEditor('1. First\n2. Second\n3. Third\n');
});
btnInlineCode?.addEventListener('click', () => { insertIntoEditor('`inline code`'); });

// Insert items
btnInsertImg?.addEventListener('click', () => {
  insertIntoEditor('![alt text](http://placehold.it/200 "Image Title")');
});
btnInsertLink?.addEventListener('click', () => {
  insertIntoEditor('[Link Text](http://example.com)');
});
btnInsertTable?.addEventListener('click', () => {
  const tableMD = `
| Col1 | Col2 | Col3 |
|------|------|------|
| Data | Data | Data |
`;
  insertIntoEditor(tableMD);
});
btnInsertCode?.addEventListener('click', () => {
  insertIntoEditor("```\n// Your code here\nconsole.log('Hello!');\n```");
});
btnSpellcheck?.addEventListener('click', () => {
  alert('Spell check not implemented.');
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Theme toggle
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
toggleTheme.addEventListener('change', (e) => {
  document.body.classList.toggle('light-theme', e.target.checked);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Context menu rename/duplicate/delete
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
document.addEventListener('click', () => {
  if (ctxMenu.style.display === 'flex') {
    ctxMenu.style.display = 'none';
  }
});

ctxRename.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  renameOverlay.style.display = 'flex';
  renameInput.value = sections[contextSectionIndex].title;
  ctxMenu.style.display = 'none';
});
ctxDuplicate.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  const original = sections[contextSectionIndex];
  const newSec = {
    title: original.title + ' (Copy)',
    content: original.content
  };
  sections.splice(contextSectionIndex + 1, 0, newSec);
  currentSectionIndex = contextSectionIndex + 1;
  updateSectionsList();
  markdownEditor.value = newSec.content;
  renderMarkdown();
  ctxMenu.style.display = 'none';
  contextSectionIndex = null;
});
ctxDelete.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  sections.splice(contextSectionIndex, 1);
  if (sections.length === 0) {
    sections.push({ title: 'Untitled', content: '' });
    currentSectionIndex = 0;
  } else if (contextSectionIndex <= currentSectionIndex && currentSectionIndex > 0) {
    currentSectionIndex--;
  }
  updateSectionsList();
  markdownEditor.value = sections[currentSectionIndex].content;
  renderMarkdown();
  ctxMenu.style.display = 'none';
  contextSectionIndex = null;
});

// Rename overlay
renameSave.addEventListener('click', () => {
  const newName = renameInput.value.trim();
  if (newName && contextSectionIndex != null) {
    sections[contextSectionIndex].title = newName;
    updateSectionsList();
  }
  renameOverlay.style.display = 'none';
  contextSectionIndex = null;
});
renameCancel.addEventListener('click', () => {
  renameOverlay.style.display = 'none';
  contextSectionIndex = null;
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Vertical splitter => save new width to settings
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
let isDraggingVert = false;
verticalSplitter.addEventListener('mousedown', () => {
  if (pinnedSidebar) return; // If pinned, don't allow resizing
  isDraggingVert = true;
});
document.addEventListener('mousemove', (e) => {
  if (!isDraggingVert) return;
  const newWidth = e.pageX;
  if (newWidth < 150) return;
  sidebarWidth = newWidth;
  sidebarContainer.style.width = sidebarWidth + 'px';
});
document.addEventListener('mouseup', () => {
  if (isDraggingVert) {
    isDraggingVert = false;
    // Now we save to settings
    console.log('[Renderer] Updating settings with new sidebarWidth:', sidebarWidth);
    ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
  }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// File handling
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
btnOpen.addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});
ipcRenderer.on('open-file-result', (event, data) => {
  if (data.canceled) return;
  if (data.isProject) {
    // .json => multiple sections
    sections = data.sections;
    currentFilePath = data.filePath;
    isProjectFile = true;
    currentSectionIndex = 0;
    if (!sections.length) {
      sections.push({ title: 'Untitled', content: '' });
    }
    markdownEditor.value = sections[currentSectionIndex].content;
    updateSectionsList();
    renderMarkdown();
  } else {
    // single .md => one section
    sections = [{ title: path.basename(data.filePath), content: data.content }];
    currentFilePath = data.filePath;
    isProjectFile = false;
    currentSectionIndex = 0;
    markdownEditor.value = data.content;
    updateSectionsList();
    renderMarkdown();
  }

  // Add to recent files
  ipcRenderer.send('update-recent-files', currentFilePath);
});

btnSave.addEventListener('click', () => {
  if (sections.length > 1) {
    ipcRenderer.send('save-file-dialog', {
      isProject: true,
      sections
    });
  } else {
    ipcRenderer.send('save-file-dialog', {
      isProject: false,
      content: sections[0].content
    });
  }
});
ipcRenderer.on('save-file-result', (event, data) => {
  if (!data.canceled) {
    currentFilePath = data.filePath;
    alert('File saved: ' + data.filePath);

    // Also update recent files
    ipcRenderer.send('update-recent-files', currentFilePath);
  }
});

// New project
btnNew.addEventListener('click', () => {
  sections = [{ title: 'Introduction', content: '' }];
  currentSectionIndex = 0;
  currentFilePath = null;
  isProjectFile = false;
  updateSectionsList();
  markdownEditor.value = '';
  renderMarkdown();
});

// Export to HTML
btnExportHtml.addEventListener('click', () => {
  ipcRenderer.send('export-html', sections);
});
ipcRenderer.on('export-html-result', (event, data) => {
  if (!data.canceled) {
    alert(`HTML exported to: ${data.filePath}`);
  }
});

// Export to PDF
btnExportPdf.addEventListener('click', () => {
  ipcRenderer.send('menu-export-pdf'); // triggers "menu-export-pdf" in main
});
ipcRenderer.on('export-pdf-result', (event, data) => {
  if (data.error) {
    alert('Export PDF error: ' + data.error);
  } else if (data.filePath) {
    alert(`PDF exported to: ${data.filePath}`);
  }
});

// Menu triggers from main
ipcRenderer.on('menu-new-project', () => { btnNew.click(); });
ipcRenderer.on('menu-open-file', () => { btnOpen.click(); });
ipcRenderer.on('menu-save-file', () => { btnSave.click(); });
ipcRenderer.on('menu-export-html', () => { btnExportHtml.click(); });
ipcRenderer.on('menu-export-pdf', () => { btnExportPdf.click(); });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Recent Files Overlay
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
btnRecentFiles.addEventListener('click', () => {
  // Rebuild the list
  recentFilesList.innerHTML = '';
  if (recentFiles.length === 0) {
    const li = document.createElement('li');
    li.textContent = '(No recent files)';
    li.style.color = '#888';
    recentFilesList.appendChild(li);
  } else {
    recentFiles.forEach(filePath => {
      const li = document.createElement('li');
      li.textContent = filePath;
      li.addEventListener('click', () => {
        // Direct approach would open the file. We'll do the "open-file-dialog" approach
        ipcRenderer.send('open-file-dialog');
        hideRecentFiles();
      });
      recentFilesList.appendChild(li);
    });
  }
  recentFilesOverlay.style.display = 'flex';
});

closeRecent.addEventListener('click', () => {
  hideRecentFiles();
});

function hideRecentFiles() {
  recentFilesOverlay.style.display = 'none';
}

// Listen for updated recent files from main
ipcRenderer.on('recent-files-updated', (event, files) => {
  recentFiles = files;
  // Also save to settings along with other fields
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

// Auto Save toggle
chkAutoSave.addEventListener('change', (e) => {
  autoSave = e.target.checked;
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

// Pin Sidebar toggle
btnPinSidebar.addEventListener('click', () => {
  pinnedSidebar = !pinnedSidebar; // toggle
  applyPinnedSidebar();
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

console.log('[Renderer] renderer.js fully initialized');
