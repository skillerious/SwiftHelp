window.addEventListener('DOMContentLoaded', () => {
  const sectionsList = document.getElementById('viewer-sections');
  const contentInner = document.getElementById('viewer-content-inner');

  // Load help-data.json (created during export)
  fetch('help-data.json')
    .then(response => response.json())
    .then(data => {
      // data is an array of { title, html }
      data.forEach((section, index) => {
        const li = document.createElement('li');
        li.textContent = section.title;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          contentInner.innerHTML = section.html;
        });
        sectionsList.appendChild(li);

        // Load the first section by default
        if (index === 0) {
          contentInner.innerHTML = section.html;
        }
      });
    })
    .catch(err => {
      contentInner.innerHTML = `<p style="color:red;">Error loading help data: ${err.message}</p>`;
    });
});
