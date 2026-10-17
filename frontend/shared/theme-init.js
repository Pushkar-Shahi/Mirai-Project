/* Applies the saved (or system) theme before first paint. Loaded as a classic,
   render-blocking script so the page never flashes the wrong theme. */
try{var t=localStorage.getItem('mirai-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}
