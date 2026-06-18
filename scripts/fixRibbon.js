const fs = require('fs');
const css = fs.readFileSync('src/style.css', 'utf-8');
console.log(css.match(/\.ribbon-bottom-left\s*{[^}]*}/)[0]);
