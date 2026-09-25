const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

// Garantir diretórios limpos
fs.mkdirSync(path.join(dist, 'css'), { recursive: true });
fs.mkdirSync(path.join(dist, 'js'), { recursive: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

// Copiar arquivos necessários para a distribuição
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
if (fs.existsSync(path.join(root, 'favicon.svg'))) {
  fs.copyFileSync(path.join(root, 'favicon.svg'), path.join(dist, 'favicon.svg'));
}
fs.copyFileSync(path.join(root, 'css', 'style.css'), path.join(dist, 'css', 'style.css'));
fs.copyFileSync(path.join(root, 'css', 'tailwind.min.css'), path.join(dist, 'css', 'tailwind.min.css'));
fs.copyFileSync(path.join(root, 'js', 'app.js'), path.join(dist, 'js', 'app.js'));
fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });

console.log('Distribuicao desktop em dist/ sincronizada com sucesso.');
