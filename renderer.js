/********************************************************************
 * renderer.js
 * Ensures links in the preview open in an external browser
 * (shell.openExternal), preserving user’s content/work.
 ********************************************************************/
console.log('[Renderer] renderer.js loaded');

const { ipcRenderer, shell } = require('electron'); 
// Note: we also destructure "shell" from electron to open external links

const path = require('path');
const marked = require('marked');

// Code highlighting config
marked.setOptions({
  highlight(code, lang) {
    if (window.hljs) {
      if (lang && window.hljs.getLanguage(lang)) {
        return window.hljs.highlight(code, { language: lang }).value;
      }
      return window.hljs.highlightAuto(code).value;
    }
    return code;
  }
});
marked.use({ mangle: false, headerIds: false });

// Sections array
let sections = [
  { title: 'Introduction', content: '# Introduction\n\nHello world!' }
];
let currentSectionIndex = 0;
let currentFilePath = null;
let isProjectFile = false;

// We'll store user-chosen widths, pinned sidebar, autoSave, etc.
let sidebarWidth = 300;
let autoSave = false;
let pinnedSidebar = false;
let recentFiles = [];

// CodeMirror reference
let codeMirrorEditor = null;

// auto-save
let autoSaveTimer = null;
const AUTO_SAVE_DELAY = 2000;

// Grab references
const previewContent = document.getElementById('preview-content');
const sectionsList = document.getElementById('sections-list');
const sidebarContainer = document.getElementById('sidebar-container');
const verticalSplitter = document.getElementById('vertical-splitter');

// Toolbar references
const btnNew = document.getElementById('btn-new');
const btnOpen = document.getElementById('btn-open');
const btnSave = document.getElementById('btn-save');
const btnExportHtml = document.getElementById('btn-export-html');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnPlay = document.getElementById('btn-play');
const btnSettings = document.getElementById('btn-settings');

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
const btnHeading = document.getElementById('btn-heading');
const btnQuote = document.getElementById('btn-quote');

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

const tableEditorOverlay = document.getElementById('table-editor-overlay');
const tableEditorApply = document.getElementById('table-editor-apply');
const tableEditorCancel = document.getElementById('table-editor-cancel');
const tableRowsInput = document.getElementById('table-rows');
const tableColsInput = document.getElementById('table-cols');

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// init => load settings + create CodeMirror
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
      if (chkAutoSave) chkAutoSave.checked = autoSave;
    })
    .catch((err) => {
      console.log('[Renderer] load-settings error:', err);
    })
    .finally(() => {
      // Create CodeMirror
      codeMirrorEditor = CodeMirror(document.getElementById('editor-cm'), {
        value: sections[currentSectionIndex].content || '',
        mode: 'markdown',
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: true
      });

      // Listen for changes
      codeMirrorEditor.on('change', (instance, changeObj) => {
        sections[currentSectionIndex].content = instance.getValue();
        renderMarkdown();

        if (autoSave) {
          if (autoSaveTimer) clearTimeout(autoSaveTimer);
          autoSaveTimer = setTimeout(() => {
            tryAutoSave();
          }, AUTO_SAVE_DELAY);
        }
      });

      // initial
      renderMarkdown();
      updateSectionsList();
    });
}
init();

function applySidebarWidth() {
  if (sidebarContainer) {
    sidebarContainer.style.width = sidebarWidth + 'px';
  }
}
function applyPinnedSidebar() {
  const splitContainer = document.getElementById('main-split-container');
  if (!splitContainer) return;
  if (pinnedSidebar) {
    splitContainer.classList.add('pinned');
  } else {
    splitContainer.classList.remove('pinned');
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// renderMarkdown => parse current content
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function renderMarkdown() {
  const raw = sections[currentSectionIndex].content || '';
  const html = marked.parse(raw);
  if (previewContent) {
    previewContent.innerHTML = html;

    // highlight code blocks if needed
    if (window.hljs) {
      previewContent.querySelectorAll('pre code').forEach(block => {
        window.hljs.highlightBlock(block);
      });
    }

    // 1) after setting the innerHTML, intercept link clicks
    previewContent.querySelectorAll('a').forEach(linkEl => {
      linkEl.addEventListener('click', (evt) => {
        evt.preventDefault();
        // open link in external browser => preserve app state
        shell.openExternal(linkEl.href);
      });
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

    const titleSpan = document.createElement('span');
    titleSpan.textContent = section.title;
    titleSpan.style.cursor = 'pointer';
    titleSpan.addEventListener('click', () => {
      currentSectionIndex = idx;
      codeMirrorEditor.setValue(section.content || '');
      updateSectionsList();
      renderMarkdown();
    });

    // Up arrow
    const upBtn = document.createElement('button');
    upBtn.textContent = '▲';
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx > 0) {
        const tmp = sections[idx];
        sections[idx] = sections[idx - 1];
        sections[idx - 1] = tmp;
        if (currentSectionIndex === idx) currentSectionIndex--;
        updateSectionsList();
        codeMirrorEditor.setValue(sections[currentSectionIndex].content || '');
        renderMarkdown();
      }
    });

    // Down arrow
    const downBtn = document.createElement('button');
    downBtn.textContent = '▼';
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx < sections.length - 1) {
        const tmp = sections[idx];
        sections[idx] = sections[idx + 1];
        sections[idx + 1] = tmp;
        if (currentSectionIndex === idx) currentSectionIndex++;
        updateSectionsList();
        codeMirrorEditor.setValue(sections[currentSectionIndex].content || '');
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

// auto-save
function tryAutoSave() {
  if (!currentFilePath) {
    console.log('[Renderer] Auto-save skipped - no file path yet');
    return;
  }
  console.log('[Renderer] Auto-saving...');
  if (sections.length > 1) {
    ipcRenderer.send('save-file-dialog', { isProject: true, sections });
  } else {
    ipcRenderer.send('save-file-dialog', { isProject: false, content: sections[0].content });
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Add section
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
btnAddSection?.addEventListener('click', () => {
  const newTitle = `Section ${sections.length + 1}`;
  sections.push({ title: newTitle, content: '' });
  currentSectionIndex = sections.length - 1;
  codeMirrorEditor.setValue('');
  renderMarkdown();
  updateSectionsList();
});

// Search & Replace
btnSearch?.addEventListener('click', () => {
  const searchTerm = (searchInput.value || '').trim();
  if (!searchTerm) return;
  let content = sections[currentSectionIndex].content;
  const regex = new RegExp(searchTerm, 'gi');
  const replaced = content.replace(regex, match => `<<HIGHLIGHT>>${match}<<ENDHIGHLIGHT>>`);
  sections[currentSectionIndex].content = replaced;
  codeMirrorEditor.setValue(replaced);
  renderMarkdown();

  const rawHTML = previewContent.innerHTML;
  const finalHTML = rawHTML.replace(/<<HIGHLIGHT>>(.*?)<<ENDHIGHLIGHT>>/g, (m, g1) => {
    return `<span class="highlight">${g1}</span>`;
  });
  previewContent.innerHTML = finalHTML;

  // revert
  sections[currentSectionIndex].content = content;
  codeMirrorEditor.setValue(content);
});
btnReplace?.addEventListener('click', () => {
  const sTerm = searchInput.value || '';
  const rTerm = replaceInput.value || '';
  if (!sTerm) return;
  const oldContent = sections[currentSectionIndex].content || '';
  const newContent = oldContent.replaceAll(sTerm, rTerm);
  sections[currentSectionIndex].content = newContent;
  codeMirrorEditor.setValue(newContent);
  renderMarkdown();
});

// Insert text at CodeMirror cursor
function insertIntoEditor(mdText) {
  const doc = codeMirrorEditor.getDoc();
  const cursor = doc.getCursor();
  doc.replaceRange(mdText, cursor);
  sections[currentSectionIndex].content = codeMirrorEditor.getValue();
  renderMarkdown();
}

btnBold?.addEventListener('click', () => insertIntoEditor('**Bold**'));
btnItalic?.addEventListener('click', () => insertIntoEditor('_Italic_'));
btnUnderline?.addEventListener('click', () => insertIntoEditor('<u>Underline</u>'));
btnBulletList?.addEventListener('click', () => insertIntoEditor('- Item 1\n- Item 2\n- Item 3\n'));
btnNumberList?.addEventListener('click', () => insertIntoEditor('1. First\n2. Second\n3. Third\n'));
btnInlineCode?.addEventListener('click', () => insertIntoEditor('`inline code`'));
btnHeading?.addEventListener('click', () => insertIntoEditor('\n# Heading 1\n'));
btnQuote?.addEventListener('click', () => insertIntoEditor('> Blockquote goes here\n'));

btnInsertImg?.addEventListener('click', () => {
  insertIntoEditor('![alt text](http://placehold.it/200 "Image Title")');
});
btnInsertLink?.addEventListener('click', () => {
  insertIntoEditor('[Link Text](http://example.com)');
});
btnInsertTable?.addEventListener('click', () => {
  tableEditorOverlay.style.display = 'flex';
});
btnInsertCode?.addEventListener('click', () => {
  insertIntoEditor("```\n// Your code here\nconsole.log('Hello!');\n```");
});
btnSpellcheck?.addEventListener('click', () => {
  alert('Spell check not implemented.');
});

// Context menu rename/duplicate/delete
document.addEventListener('click', () => {
  if (ctxMenu && ctxMenu.style.display === 'flex') {
    ctxMenu.style.display = 'none';
  }
});
ctxRename?.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  renameOverlay.style.display = 'flex';
  renameInput.value = sections[contextSectionIndex].title;
  if (ctxMenu) ctxMenu.style.display = 'none';
});
ctxDuplicate?.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  const original = sections[contextSectionIndex];
  const newSec = { title: original.title + ' (Copy)', content: original.content };
  sections.splice(contextSectionIndex + 1, 0, newSec);
  currentSectionIndex = contextSectionIndex + 1;
  codeMirrorEditor.setValue(newSec.content || '');
  updateSectionsList();
  renderMarkdown();
  if (ctxMenu) ctxMenu.style.display = 'none';
  contextSectionIndex = null;
});
ctxDelete?.addEventListener('click', () => {
  if (contextSectionIndex == null) return;
  sections.splice(contextSectionIndex, 1);
  if (sections.length === 0) {
    sections.push({ title: 'Untitled', content: '' });
    currentSectionIndex = 0;
  } else if (contextSectionIndex <= currentSectionIndex && currentSectionIndex > 0) {
    currentSectionIndex--;
  }
  codeMirrorEditor.setValue(sections[currentSectionIndex].content || '');
  updateSectionsList();
  renderMarkdown();
  if (ctxMenu) ctxMenu.style.display = 'none';
  contextSectionIndex = null;
});
renameSave?.addEventListener('click', () => {
  const newName = renameInput.value.trim();
  if (newName && contextSectionIndex != null) {
    sections[contextSectionIndex].title = newName;
    updateSectionsList();
  }
  renameOverlay.style.display = 'none';
  contextSectionIndex = null;
});
renameCancel?.addEventListener('click', () => {
  renameOverlay.style.display = 'none';
  contextSectionIndex = null;
});

// vertical splitter => save new sidebar width
let isDraggingVert = false;
verticalSplitter?.addEventListener('mousedown', () => {
  if (pinnedSidebar) return;
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
    console.log('[Renderer] Updating settings with new sidebarWidth:', sidebarWidth);
    ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
  }
});

// File handling
btnOpen?.addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});
ipcRenderer.on('open-file-result', (event, data) => {
  if (data.canceled) return;
  if (data.isProject) {
    sections = data.sections;
    currentFilePath = data.filePath;
    isProjectFile = true;
    currentSectionIndex = 0;
    if (!sections.length) {
      sections.push({ title: 'Untitled', content: '' });
    }
    codeMirrorEditor.setValue(sections[currentSectionIndex].content || '');
    updateSectionsList();
    renderMarkdown();
  } else {
    sections = [{ title: path.basename(data.filePath), content: data.content }];
    currentFilePath = data.filePath;
    isProjectFile = false;
    currentSectionIndex = 0;
    codeMirrorEditor.setValue(data.content || '');
    updateSectionsList();
    renderMarkdown();
  }
  ipcRenderer.send('update-recent-files', currentFilePath);
});
btnSave?.addEventListener('click', () => {
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
    ipcRenderer.send('update-recent-files', currentFilePath);
  }
});

// New project
btnNew?.addEventListener('click', () => {
  sections = [{ title: 'Introduction', content: '' }];
  currentSectionIndex = 0;
  currentFilePath = null;
  isProjectFile = false;
  updateSectionsList();
  codeMirrorEditor.setValue('');
  renderMarkdown();
});

// Export to HTML
btnExportHtml?.addEventListener('click', () => {
  ipcRenderer.send('export-html', sections);
});
ipcRenderer.on('export-html-result', (event, data) => {
  if (!data.canceled) {
    alert(`HTML exported to: ${data.filePath}`);
  }
});

// Export to PDF
btnExportPdf?.addEventListener('click', () => {
  ipcRenderer.send('menu-export-pdf');
});
ipcRenderer.on('export-pdf-result', (event, data) => {
  if (data.error) {
    alert('Export PDF error: ' + data.error);
  } else if (data.filePath) {
    alert(`PDF exported to: ${data.filePath}`);
  }
});

// Menu triggers from main
ipcRenderer.on('menu-new-project', () => { btnNew?.click(); });
ipcRenderer.on('menu-open-file', () => { btnOpen?.click(); });
ipcRenderer.on('menu-save-file', () => { btnSave?.click(); });
ipcRenderer.on('menu-export-html', () => { btnExportHtml?.click(); });
ipcRenderer.on('menu-export-pdf', () => { btnExportPdf?.click(); });

// Recent Files
btnRecentFiles?.addEventListener('click', () => {
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
        ipcRenderer.send('open-file-dialog');
        hideRecentFiles();
      });
      recentFilesList.appendChild(li);
    });
  }
  recentFilesOverlay.style.display = 'flex';
});
closeRecent?.addEventListener('click', () => {
  hideRecentFiles();
});
function hideRecentFiles() {
  recentFilesOverlay.style.display = 'none';
}
ipcRenderer.on('recent-files-updated', (event, files) => {
  recentFiles = files;
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

// Auto Save toggle
chkAutoSave?.addEventListener('change', (e) => {
  autoSave = e.target.checked;
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

// Pin Sidebar toggle
btnPinSidebar?.addEventListener('click', () => {
  pinnedSidebar = !pinnedSidebar;
  applyPinnedSidebar();
  ipcRenderer.send('save-settings', { sidebarWidth, recentFiles, autoSave, pinnedSidebar });
});

// "Play" => preview in browser
btnPlay?.addEventListener('click', () => {
  console.log('[Renderer] Play button clicked => preview in browser');
  const sectionsData = sections.map(sec => ({
    title: sec.title,
    content: sec.content
  }));
  ipcRenderer.send('preview-in-browser', sectionsData);
});

// "Settings" => open settings.html
btnSettings?.addEventListener('click', () => {
  ipcRenderer.send('open-settings');
});

// Provide getCurrentSectionsData
window.getCurrentSectionsData = function() {
  return sections.map(sec => ({
    title: sec.title,
    content: sec.content
  }));
};

console.log('[Renderer] renderer.js fully initialized');
