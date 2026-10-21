try { document.documentElement.dataset.theme = localStorage.getItem('jomei-theme') || 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }

try { document.documentElement.lang = localStorage.getItem('jomei-language') === 'de' ? 'de' : 'en'; } catch { document.documentElement.lang = 'en'; }
