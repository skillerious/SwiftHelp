
# SwiftHelp

SwiftHelp is a versatile **Electron-based help-authoring tool** created by [**Skillerious**](https://github.com/Skillerious). It enables you to write and organize documentation in multiple sections, edit in Markdown, preview changes in real time, and export to HTML or PDF—complete with features like **syntax highlighting**, **auto-save**, **recent files**, **pinned sidebars**, **draggable sections**, and a **context menu** to rename/duplicate/delete sections seamlessly.

---

## Table of Contents

1. [Features](#features)  
2. [Screenshots](#screenshots)  
3. [Getting Started](#getting-started)  
   - [Prerequisites](#prerequisites)  
   - [Installation](#installation)  
   - [Running the App](#running-the-app)  
4. [Usage](#usage)  
   - [Section Management](#section-management)  
   - [Markdown Editing](#markdown-editing)  
   - [Auto Save & Recent Files](#auto-save--recent-files)  
   - [Pinned Sidebar](#pinned-sidebar)  
   - [Draggable Sections & Context Menu](#draggable-sections--context-menu)  
   - [Export to HTML/PDF](#export-to-htmlpdf)  
   - [Light/Dark Mode](#lightdark-mode)  
5. [File Structure](#file-structure)  
6. [Packaging / Distribution](#packaging--distribution)  
7. [Advanced Customization](#advanced-customization)  
8. [Known Issues / Limitations](#known-issues--limitations)  
9. [Contributing](#contributing)  
10. [License](#license)  
11. [Contact](#contact)  

---

## Features

- **Multi-Section Editor**  
  Create numerous sections in a single workspace. Add new sections, rename them, reorder them by **dragging** a small handle, or remove them entirely.

- **Markdown Preview**  
  Edit your content in Markdown and preview changes instantly.  
  *Supports tables, links, images, code blocks, lists, and more.*

- **Syntax Highlighting**  
  Built-in code syntax highlighting (via [highlight.js](https://highlightjs.org/)) for an improved reading experience in the preview panel.

- **Draggable Sections**  
  Each section in the sidebar features a small **drag icon** (`drag.png`), indicating you can press and drag the entire section item to reorder it. A context menu (right-click) also provides quick actions like rename, duplicate, or delete.

- **Context Menu**  
  Right-click any section to “Rename,” “Duplicate,” or “Delete.” A rename overlay and duplication logic keep your project flexible.

- **Export to HTML**  
  Generate a slick, offcanvas-style HTML file with next/prev navigation, search highlighting, and a pinned title bar.

- **Export to PDF**  
  Save your final compiled help sections as a PDF—ideal for emailing or offline distribution.

- **Auto-Save**  
  An optional auto-save feature triggers a short time after the last keystroke, ensuring you don’t lose work.

- **Recent Files**  
  Keep track of up to five recently opened files/projects, so you can quickly jump back into your docs. Data is stored in `settings.json`.

- **Pinned Sidebar**  
  Fix the sidebar’s width and prevent unintentional resizing when you want a consistent layout. When pinned, the vertical splitter is disabled.

- **Light/Dark Mode**  
  Switch between a dark theme (great for nighttime writing) and a bright, modern light theme.  

- **Scroll Sync**  
  Editor and Preview panels remain in sync while scrolling—jump directly to the corresponding preview location as you scroll in the editor, and vice versa.

---

## Screenshots

1. **Main Editor Window**  
   ![Main Editor Preview](https://github.com/skillerious/SwiftHelp/blob/main/assets/screenshots/SwinftHelpEditor.png)

2. **Draggable Sections & Context Menu**  
   ![Main Editor Preview](https://github.com/skillerious/SwiftHelp/blob/main/assets/screenshots/SwiftHelpSidebar.png)  

3. **Exported HTML**  
   ![Exported HTML Preview](https://github.com/Skillerious/SwiftHelp/blob/main/assets/screenshots/exported.png)

4. **Exported HTML - Navigation**  
   ![Exported HTML Preview](https://github.com/skillerious/SwiftHelp/blob/main/assets/screenshots/exportedsidebar.png)

5. **Settings**  
   ![settings.json Example](https://github.com/skillerious/SwiftHelp/blob/main/assets/screenshots/SwiftHelpSettings.png)

---

## Getting Started

### Prerequisites

- **Node.js** (version 14 or higher recommended)  
- **npm** or **yarn** (for installing dependencies)  
- A basic understanding of **Markdown** syntax.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Skillerious/SwiftHelp.git
   cd SwiftHelp
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
   This will fetch **Electron**, **marked**, **highlight.js**, and other necessary libraries.

### Running the App

- **Development** mode:
  ```bash
  npm start
  ```
  This launches Electron using your local files. The console logs in `main.js` and `renderer.js` will output to your terminal, so you can debug in real time.

- (Optional) **Building** a production package:
  ```bash
  npm run build
  ```
  *(If you’ve configured [electron-builder](https://www.electron.build/) or [electron-packager](https://github.com/electron/electron-packager).)*

---

## Usage

### Section Management

- **Add Section**: Click the **+ Add Section** button in the sidebar.  
- **Rename**: Right-click a section title and choose *Rename*; an overlay prompts you for the new name.  
- **Duplicate**: Right-click and choose *Duplicate* to quickly copy a section.  
- **Delete**: Remove any section you no longer need. If you remove the currently active section, SwiftHelp shifts focus to another existing section.  
- **Reorder**: Press and hold the **drag handle** icon (small PNG named `drag.png`) on each section to drag the section item up or down the list.

### Markdown Editing

1. Write text in the **Editor** panel (on the left side).  
2. SwiftHelp uses [**marked**](https://github.com/markedjs/marked) to parse your Markdown into HTML in real time.  
3. The preview (right side) shows exactly how your docs will look—complete with **scroll sync** to stay aligned with your editing.

### Auto Save & Recent Files

- **Auto Save**: Toggle the “Auto Save” checkbox (in the settings or top toolbar). Changes to the text will trigger an auto-save after a small delay.  
- **Recent Files**: Up to five files/projects are tracked in `settings.json`. Click the **Recent** button to open that overlay and load them quickly.

### Pinned Sidebar

- When “Pin Sidebar” is active, the vertical splitter is hidden. The sidebar’s width remains fixed, so you won’t resize it accidentally.

### Draggable Sections & Context Menu

- **Drag** any section item by its **`drag.png`** icon. The underlying code (in `renderer.js`) uses the `dragstart`, `dragover`, `drop`, and `dragend` events to reorder the sections array.  
- **Context Menu** (right-click):
  - **Rename**: Brings up an overlay to rename the section.  
  - **Duplicate**: Copies that section’s title and content.  
  - **Delete**: Removes that section from the project.

### Export to HTML/PDF

- **HTML**: Go to `File -> Export to HTML` or press **CmdOrCtrl+E**, choose a file path. SwiftHelp then calls `buildEnhancedDarkHtml()` in `main.js` to produce a self-contained HTML doc with your sections, next/prev navigation, and optional search.  
- **PDF**: Similarly, `File -> Export to PDF` or press **CmdOrCtrl+Shift+P`. SwiftHelp merges your sections into a PDF (placeholder or real PDF logic if you add one).

### Light/Dark Mode

- Click the **Light Mode** switch in settings (or if you’ve bound it to a toolbar button). You can store that preference in `settings.json`.  
- The exported HTML has its own stylings, but you can unify them or choose a dark export theme if desired.

---

## File Structure

A typical layout:

```
SwiftHelp/
  ├── main.js            // Electron main process (creates BrowserWindow, menus)
  ├── index.html         // Primary UI layout (toolbar, side-by-side editor/preview)
  ├── renderer.js        // In-app logic: sections array, auto-save, context menu, etc.
  ├── style.css          // Central styling (scrollbars, pinned sidebars, overlays)
  ├── package.json       // Project metadata & scripts
  ├── assets/            // PNG icons (new.png, open.png, save.png, drag.png, etc.)
  ├── templates/         // Possibly your 'Dark-Template.html' for exported HTML
  └── settings.json      // Auto-generated for user preferences
```

---

## Packaging / Distribution

Use [**electron-builder**](https://www.electron.build/) or [**electron-packager**](https://github.com/electron/electron-packager) to generate installers for Windows, macOS, or Linux:

1. `npm install --save-dev electron-builder`  
2. Add a script in `package.json`:
   ```json
   {
     "scripts": {
       "build": "electron-builder"
     }
   }
   ```
3. `npm run build` => produces ready-to-distribute binaries.

Check each tool’s docs for code signing, auto-updates, advanced configs, etc.

---

## Advanced Customization

1. **Spell Check**:  
   The `btnSpellcheck` triggers a placeholder alert. Integrate something like [**electron-spellchecker**](https://github.com/electron-userland/electron-spellchecker) if you need real-time or context-based checking.

2. **Multi-User Collaboration**:  
   You could store `.json` projects in a shared folder or use Git for version control. Merging conflicts in Markdown is typically straightforward, but you might add an in-app conflict resolution system if needed.

3. **Theming**:  
   Extend the existing light/dark mode to your exported HTML, or create your own CSS override in `buildEnhancedDarkHtml()` in `main.js`.

4. **Search All Sections**:  
   Currently, we highlight only in the active section. Expand that to a global search if you want a single search box scanning every section.

---

## Known Issues / Limitations

- **No “Undo” for Section Deletions**: Once you delete a section, it’s removed from the array. If you need to revert, you must re-add it manually or restore from a saved project.  
- **Auto-Save Without File Path**: If you haven’t “Save As” at least once, auto-save can’t proceed.  
- **Spell Check**: Not implemented.  
- **Large Projects**: With extremely large `.json` files or hundreds of sections, performance might degrade without further optimization or lazy-loading.

---

## Contributing

1. **Fork** this repo.  
2. Create your feature branch: `git checkout -b feature/myNewFeature`.  
3. Commit changes: `git commit -m "Add new feature"`.  
4. Push branch: `git push origin feature/myNewFeature`.  
5. **Open a Pull Request** describing your improvements.  

We welcome bug fixes, new features, and updates to documentation.

---

## License

*(Assuming MIT, or whichever you prefer)*

```
MIT License

Copyright (c) 2023 Skillerious

Permission is hereby granted, free of charge, to any person obtaining a copy
...
```

---

## Contact

- **Author**: [Skillerious](https://github.com/Skillerious)  
- **Repository**: [SwiftHelp on GitHub](https://github.com/Skillerious/SwiftHelp)

For questions or feedback, open a GitHub issue or drop me a message. Enjoy writing your docs with **SwiftHelp**!
