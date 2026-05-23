// server.js
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;

const server = http.createServer((req, res) => {
    // Evitamos salir del directorio actual
    let safeUrl = req.url.split('?')[0];
    if (safeUrl === '/') {
        safeUrl = '/index.html';
    }

    const filePath = path.join(process.cwd(), safeUrl);

    // Verificamos que el archivo esté dentro del directorio de trabajo
    if (!filePath.startsWith(process.cwd())) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Sorry, check with the site admin for error: ${error.code} ..\n`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Servidor web listo en http://localhost:${PORT}`);
    console.log('Presiona Ctrl+C para detenerlo.\n');
});
