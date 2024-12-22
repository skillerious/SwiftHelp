
# SwiftHelp

SwiftHelp is a versatile **Electron-based help-authoring tool** created by [**Skillerious**](https://github.com/Skillerious). It enables you to write and organize documentation in multiple sections, edit in Markdown, preview changes in real time, and then export to HTML or PDF—complete with features like **syntax highlighting**, **auto-save**, **recent files**, and **pinned sidebars**.

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
  Create numerous sections in a single workspace. Add new sections easily, rename, or reorder them to keep your help docs neatly structured.

- **Markdown Preview**  
  Edit your content in Markdown, and preview changes instantly.  
  *Supports tables, links, images, code blocks, lists, and more.*

- **Syntax Highlighting**  
  Built-in code syntax highlighting (via [highlight.js](https://highlightjs.org/)) for an improved reading experience in the preview panel.

- **Export to HTML**  
  Generate a slick, offcanvas-style HTML file with next/prev navigation, search highlighting, and a pinned title bar.

- **Export to PDF**  
  Save your final compiled help sections as a PDF—great for emailing or offline distribution.

- **Auto-Save**  
  An optional auto-save feature triggers a short time after the last keystroke, ensuring you don’t lose work.

- **Recent Files**  
  Keep track of up to five recently opened files/projects, so you can quickly jump back into your docs.

- **Pinned Sidebar**  
  Fix the sidebar’s width and prevent unintentional resizing when you want a consistent layout.

- **Light/Dark Mode**  
  Switch between a dark theme (ideal for late-night writing sessions) and a bright, modern light theme.

---

## Screenshots

*(Below are example placeholders—replace with actual images if you wish.)*

1. **Main Editor Window**  
   ![Main Editor Preview](./docs/screenshots/main_editor.png)

2. **Exported HTML**  
   ![Exported HTML Preview](./docs/screenshots/exported_html.png)

3. **Settings JSON**  
   ![settings.json Example](./docs/screenshots/settings_json.png)

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
   This will fetch **Electron**, **marked**, and any other needed libraries as declared in `package.json`.

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
  *(If you add a script or use a tool like [electron-builder](https://www.electron.build/) or [electron-packager](https://github.com/electron/electron-packager).)*

---

## Usage

### Section Management

- **Add Section**: Click the **+ Add Section** button in the sidebar.  
- **Rename**: Right-click a section title and choose *Rename*.  
- **Duplicate**: Right-click and choose *Duplicate* to quickly copy a section.  
- **Delete**: Remove a section you no longer need. The editor will shift to another section if the current one is removed.

### Markdown Editing

1. Write text in the **Editor** panel (on the left or top, depending on your screen size).  
2. SwiftHelp uses [**marked**](https://github.com/markedjs/marked) to parse your Markdown into HTML in real time.  
3. You can insert *formatted text*, *tables*, *lists*, *links*, or *images* using the toolbar or by typing Markdown syntax directly.

### Auto Save & Recent Files

- **Auto Save**: Toggle the “Auto Save” checkbox in the top toolbar. When enabled, any change to the text will trigger an auto-save after a small delay.  
- **Recent Files**: SwiftHelp tracks the last five files or projects you opened. Click the **Recent** button (clock icon) to reopen them. The data is stored in `settings.json`.

### Pinned Sidebar

- When “Pin Sidebar” is active, the vertical splitter is hidden, preventing accidental resizing. You can still scroll the sections list, but you can’t drag the width.

### Export to HTML/PDF

- **HTML**: Go to `File -> Export to HTML` or press **CmdOrCtrl+E** to choose where to save the `.html` file. SwiftHelp will generate an offcanvas-based layout with your content.  
- **PDF**: Similarly, `File -> Export to PDF` or press **CmdOrCtrl+Shift+P**. The output PDF file includes your current sections in a single, linear document.

### Light/Dark Mode

- Use the **Light Mode** switch in the top toolbar to invert the theme for the entire editor.  
- This preference does not (by default) affect the exported HTML’s theme. If you want to unify that, you can customize the code in `buildEnhancedDarkHtml()` in `main.js`.

---

## File Structure

Here’s a quick look at the main files:

- **main.js**  
  - The Electron main process. Creates the `BrowserWindow`, sets up application menus, handles open/save dialogs, merges user settings, and exports HTML/PDF.

- **index.html**  
  - The primary UI layout with toolbar buttons, side-by-side editor/preview, context menus, rename overlays, etc.

- **renderer.js**  
  - All the client-side logic for the multi-section approach, auto-save, pinned sidebars, searching, etc. Runs in the browser (renderer) process.

- **style.css**  
  - Central styling for pinned sidebars, dark/light theme toggles, scrollbars, overlays, etc.

- **assets/**  
  - PNG icons for the toolbar (e.g., `new.png`, `open.png`, `save.png`, etc.).

- **settings.json**  
  - Auto-generated. Stores the user’s preferences, such as `sidebarWidth`, `recentFiles`, etc.

*(Additional docs or configuration files may also be present if you add them.)*

---

## Packaging / Distribution

To distribute SwiftHelp as a standalone application, consider using:

- [**electron-builder**](https://www.electron.build/):  
  *Generates installers for Windows (.exe), macOS (.dmg/.pkg), and Linux (.deb/.AppImage).*

- [**electron-packager**](https://github.com/electron/electron-packager):  
  *Quickly bundles your app into an executable folder for various platforms.*

Steps might include:

1. `npm install --save-dev electron-builder` (or your chosen tool).  
2. Add a script in your `package.json`, for example:  
   ```json
   {
     "scripts": {
       "build": "electron-builder"
     }
   }
   ```  
3. Run `npm run build` to produce your distribution files.

Check each tool’s documentation for further instructions on code signing, auto-updates, advanced config, etc.

---

## Advanced Customization

1. **Spell Check**  
   - Currently, SwiftHelp displays a “Spell check not implemented” alert. Integrate libraries like [electron-spellchecker](https://github.com/electron-userland/electron-spellchecker) if you want inline or context-based checks.

2. **Multi-User Collaboration**  
   - Combine with a version control approach (Git) or a shared network folder for collaborative editing. Possibly add prompts for merging conflicts.

3. **Theming**  
   - Extend the existing theme toggle to also export in dark mode if desired. Tweak `buildEnhancedDarkHtml()` for a complete dark-mode export.

4. **Search All Sections**  
   - The current code highlights matches only in the active section. You can enhance it by scanning all sections and then listing those matches in a side panel.

---

## Known Issues / Limitations

- **Auto Save File Path**: If you have never manually saved a new project, auto-save can’t proceed. You must “Save As” at least once.  
- **Large Projects**: For extremely large `.json` files or many sections, performance might degrade without further optimization.  
- **Spell Check**: Not implemented. The button is purely a placeholder.  
- **No Undo for Deletions**: Deleting a section is permanent—there’s no built-in undo/redo for that action.  

If you encounter other issues, please create a new issue in the [GitHub repository](https://github.com/Skillerious/SwiftHelp/issues).

---

## Contributing

1. **Fork** this repo.  
2. Create your feature branch: `git checkout -b feature/myNewFeature`.  
3. Commit changes: `git commit -m "Add new feature"`.  
4. Push branch: `git push origin feature/myNewFeature`.  
5. **Open a Pull Request** explaining your changes.  

We welcome bug fixes, feature suggestions, and any helpful documentation.

---

## License

*(Choose a license that suits your project, e.g., [MIT License](https://opensource.org/licenses/MIT)):*

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
