try { document.documentElement.dataset.theme = localStorage.getItem('jomei-theme') || 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }
