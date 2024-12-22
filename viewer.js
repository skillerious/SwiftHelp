// viewer.js

window.addEventListener('DOMContentLoaded', () => {
  const sectionsList = document.getElementById('viewer-sections');
  const contentInner = document.getElementById('viewer-content-inner');

  // Load help-data.json (created during export)
  fetch('help-data.json')
    .then(response => response.json())
    .then(data => {
      // data is an array of categories
      data.forEach((category, catIndex) => {
        // Create category item
        const catLi = document.createElement('li');
        catLi.textContent = category.category;
        catLi.style.cursor = 'pointer';
        catLi.style.fontWeight = 'bold';

        // Expand/Collapse for subcategories
        catLi.addEventListener('click', () => {
          subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
        });

        // Create subcategory list
        const subUl = document.createElement('ul');
        subUl.style.listStyle = 'none';
        subUl.style.paddingLeft = '1rem';
        subUl.style.display = 'none';

        category.subcategories.forEach((subcategory, subIndex) => {
          const subLi = document.createElement('li');
          subLi.textContent = subcategory.name;
          subLi.style.cursor = 'pointer';
          subLi.style.fontStyle = 'italic';

          // Expand/Collapse for sections
          subLi.addEventListener('click', (e) => {
            e.stopPropagation();
            sectionsUl.style.display = sectionsUl.style.display === 'none' ? 'block' : 'none';
          });

          // Create sections list
          const sectionsUl = document.createElement('ul');
          sectionsUl.style.listStyle = 'none';
          sectionsUl.style.paddingLeft = '1rem';
          sectionsUl.style.display = 'none';

          subcategory.sections.forEach((section, secIndex) => {
            const sectionLi = document.createElement('li');
            sectionLi.textContent = section.title;
            sectionLi.style.cursor = 'pointer';

            // Event listener to load section content
            sectionLi.addEventListener('click', () => {
              contentInner.innerHTML = section.html;
              // Optionally, highlight the active section
              document.querySelectorAll('#viewer-sections li').forEach(li => li.style.background = 'none');
              sectionLi.style.background = '#007bff';
              sectionLi.style.color = '#fff';
            });

            sectionsUl.appendChild(sectionLi);
          });

          subUl.appendChild(subLi);
          subUl.appendChild(sectionsUl);
        });

        sectionsList.appendChild(catLi);
        sectionsList.appendChild(subUl);
      });

      // Optionally, load the first section by default
      if (data.length > 0 && data[0].subcategories.length > 0 && data[0].subcategories[0].sections.length > 0) {
        const firstSection = data[0].subcategories[0].sections[0];
        contentInner.innerHTML = firstSection.html;
        // Highlight the first section in the list
        const firstSectionLi = sectionsList.querySelector('li > ul > li > ul > li');
        if (firstSectionLi) {
          firstSectionLi.style.background = '#007bff';
          firstSectionLi.style.color = '#fff';
        }
      }
    })
    .catch(err => {
      contentInner.innerHTML = `<p style="color:red;">Error loading help data: ${err.message}</p>`;
    });
});
