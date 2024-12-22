/* toolbar.js */
document.addEventListener('DOMContentLoaded', () => {
    const toggleModeBtn = document.getElementById('toggleModeBtn');
    let isLightMode = false;
  
    toggleModeBtn.addEventListener('click', () => {
      isLightMode = !isLightMode;
      document.body.classList.toggle('light-mode', isLightMode);
      const navBar = document.getElementById('mainNavbar');
      if (navBar) {
        navBar.classList.toggle('navbar-dark', !isLightMode);
        navBar.classList.toggle('navbar-light', isLightMode);
      }
    });
  });
  