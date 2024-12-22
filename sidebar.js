// sidebar.js

const sectionsData = require('./sectionsData'); // Import the updated sections data

document.addEventListener('DOMContentLoaded', () => {
  const sectionsList = document.getElementById('sections-list');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('search-input');

  populateSidebar(sectionsData);

  // Initialize Bootstrap tooltips if needed
  // ...

  // Search functionality
  searchBtn.addEventListener('click', () => {
    const query = (searchInput.value || '').trim().toLowerCase();
    if (!query) {
      resetSidebarVisibility();
      return;
    }
    filterSidebar(query);
  });

  // Optional: Implement live search as the user types
  searchInput.addEventListener('input', () => {
    const query = (searchInput.value || '').trim().toLowerCase();
    if (!query) {
      resetSidebarVisibility();
      return;
    }
    filterSidebar(query);
  });
});

/**
 * Populates the sidebar with categories, subcategories, and sections.
 * @param {Array} categories - The sections data array.
 */
function populateSidebar(categories) {
  const sectionsList = document.getElementById('sections-list');
  sectionsList.innerHTML = ''; // Clear existing content

  categories.forEach((category, catIndex) => {
    // Create category item
    const categoryItem = document.createElement('li');
    categoryItem.classList.add('category-item');
    categoryItem.textContent = category.category;

    // Create subcategory list
    const subcategoryList = document.createElement('ul');
    subcategoryList.classList.add('subcategory-list');

    category.subcategories.forEach((subcategory, subIndex) => {
      // Create subcategory item
      const subcategoryItem = document.createElement('li');
      subcategoryItem.classList.add('subcategory-item');
      subcategoryItem.textContent = subcategory.name;

      // Create section list within subcategory
      const sectionList = document.createElement('ul');
      sectionList.classList.add('section-list');

      subcategory.sections.forEach((section, secIndex) => {
        const sectionItem = document.createElement('li');
        sectionItem.classList.add('section-item');
        sectionItem.textContent = section.title;
        sectionItem.dataset.content = section.content; // Store content for loading

        // Event listener to load section content
        sectionItem.addEventListener('click', () => {
          loadSection(section.title, section.content, sectionItem);
        });

        sectionList.appendChild(sectionItem);
      });

      // Append section list to subcategory
      subcategoryItem.appendChild(sectionList);

      // Event listener to toggle subcategory
      subcategoryItem.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling to category
        subcategoryItem.classList.toggle('collapsed');
        const isCollapsed = subcategoryItem.classList.contains('collapsed');
        sectionList.style.display = isCollapsed ? 'none' : 'block';
      });

      subcategoryList.appendChild(subcategoryItem);
    });

    // Append subcategory list to category
    categoryItem.appendChild(subcategoryList);

    // Event listener to toggle category
    categoryItem.addEventListener('click', () => {
      categoryItem.classList.toggle('collapsed');
      const isCollapsed = categoryItem.classList.contains('collapsed');
      subcategoryList.style.display = isCollapsed ? 'none' : 'block';
    });

    sectionsList.appendChild(categoryItem);
  });
}

/**
 * Loads the selected section's content into the main content area.
 * @param {string} title - The title of the section.
 * @param {string} content - The content of the section.
 * @param {HTMLElement} sectionElement - The DOM element representing the section.
 */
function loadSection(title, content, sectionElement) {
  // Remove 'active' class from all sections
  document.querySelectorAll('.section-item').forEach(item => {
    item.classList.remove('active');
  });

  // Add 'active' class to the selected section
  sectionElement.classList.add('active');

  // Communicate with renderer.js to load the section
  window.api.send('load-section', { title, content });
}

/**
 * Resets the sidebar visibility based on the search input.
 */
function resetSidebarVisibility() {
  document.querySelectorAll('.category-item').forEach(category => {
    category.style.display = 'block';
    const subList = category.querySelector('.subcategory-list');
    if (subList) {
      subList.style.display = 'none';
      category.classList.add('collapsed');
    }
  });
}

/**
 * Filters the sidebar based on the search query.
 * @param {string} query - The search query.
 */
function filterSidebar(query) {
  document.querySelectorAll('.category-item').forEach(category => {
    let categoryMatch = false;
    const subList = category.querySelector('.subcategory-list');
    if (subList) {
      subList.querySelectorAll('.subcategory-item').forEach(subcategory => {
        let subcategoryMatch = false;
        const sectionList = subcategory.querySelector('.section-list');
        if (sectionList) {
          sectionList.querySelectorAll('.section-item').forEach(section => {
            const title = section.textContent.toLowerCase();
            if (title.includes(query)) {
              section.style.display = 'block';
              subcategoryMatch = true;
              categoryMatch = true;
            } else {
              section.style.display = 'none';
            }
          });
        }

        // Show or hide subcategory based on matches
        if (subcategoryMatch) {
          subcategory.style.display = 'block';
          const sectionList = subcategory.querySelector('.section-list');
          if (sectionList) {
            sectionList.style.display = 'block';
          }
          subcategory.classList.remove('collapsed');
        } else {
          subcategory.style.display = 'none';
        }
      });
    }

    // Show or hide category based on matches
    if (categoryMatch) {
      category.style.display = 'block';
      category.classList.remove('collapsed');
      const subList = category.querySelector('.subcategory-list');
      if (subList) {
        subList.style.display = 'block';
      }
    } else {
      category.style.display = 'none';
    }
  });
}
