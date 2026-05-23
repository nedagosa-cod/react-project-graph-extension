// scanner.js
const fs = require('fs');
const path = require('path');

function obtenerGrafo(rutaProyecto) {
    const srcDir = path.join(rutaProyecto, 'src');
    const grafo = {
        nodes: [],
        links: []
    };

    if (!fs.existsSync(srcDir)) {
        return grafo;
    }

    // Resuelve rutas de importación relativas incluyendo extensiones omitidas o carpetas /index
    function resolverRuta(contenedorDir, importPath) {
        if (!importPath.startsWith('.')) {
            return importPath;
        }

        const rutaAbsoluta = path.resolve(contenedorDir, importPath);
        const extensiones = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
        
        for (const ext of extensiones) {
            const rutaConExt = rutaAbsoluta + ext;
            if (fs.existsSync(rutaConExt) && fs.statSync(rutaConExt).isFile()) {
                const relResuelta = path.relative(rutaProyecto, rutaConExt);
                return relResuelta.replace(/\\/g, '/');
            }
        }

        const relAproximada = path.relative(rutaProyecto, rutaAbsoluta);
        return relAproximada.replace(/\\/g, '/');
    }

    function escanearCarpeta(directorio) {
        const archivos = fs.readdirSync(directorio);

        for (const archivo of archivos) {
            const rutaCompleta = path.join(directorio, archivo);
            const stats = fs.statSync(rutaCompleta);

            if (stats.isDirectory()) {
                escanearCarpeta(rutaCompleta);
            } else if (
                archivo.endsWith('.js') || 
                archivo.endsWith('.jsx') || 
                archivo.endsWith('.ts') || 
                archivo.endsWith('.tsx')
            ) {
                procesarArchivo(rutaCompleta);
            }
        }
    }

    function procesarArchivo(rutaArchivo) {
        const rutaRelativa = path.relative(rutaProyecto, rutaArchivo);
        const idArchivo = rutaRelativa.replace(/\\/g, '/');

        grafo.nodes.push({ id: idArchivo, name: path.basename(rutaArchivo), type: 'local' });

        try {
            const codigo = fs.readFileSync(rutaArchivo, 'utf8');
            
            // Limpiamos comentarios para no detectar importaciones comentadas
            const codigoLimpio = codigo
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '');

            const importsEncontrados = [];

            // 1. Regex para importaciones normales: import ... from '...' o import '...'
            const importRegex = /import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
            let match;
            while ((match = importRegex.exec(codigoLimpio)) !== null) {
                importsEncontrados.push(match[1]);
            }

            // 2. Regex para importaciones dinámicas: import('...')
            const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
            while ((match = dynamicImportRegex.exec(codigoLimpio)) !== null) {
                importsEncontrados.push(match[1]);
            }

            // 3. Regex para exportaciones re-exportadas: export ... from '...'
            const exportFromRegex = /export\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
            while ((match = exportFromRegex.exec(codigoLimpio)) !== null) {
                importsEncontrados.push(match[1]);
            }

            // Procesamos cada importación
            const contenedorDir = path.dirname(rutaArchivo);
            
            for (const importPath of importsEncontrados) {
                const targetId = resolverRuta(contenedorDir, importPath);
                
                // Evitamos auto-referencias y duplicados en links
                if (targetId !== idArchivo) {
                    const yaExisteLink = grafo.links.some(l => l.source === idArchivo && l.target === targetId);
                    if (!yaExisteLink) {
                        grafo.links.push({
                            source: idArchivo,
                            target: targetId
                        });
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ No se pudo analizar el archivo ${idArchivo}: ${error.message}`);
        }
    }

    escanearCarpeta(srcDir);

    // POST-PROCESAMIENTO PARA EVITAR ERRORES D3 Y AGREGAR NODOS EXTERNOS/FALTANTES
    const nodosExistentes = new Set(grafo.nodes.map(n => n.id));

    grafo.links.forEach(link => {
        if (!nodosExistentes.has(link.target)) {
            // Si no empieza con 'src/', es un módulo externo (npm)
            const esExterno = !link.target.startsWith('src/');
            const tipo = esExterno ? 'external' : 'missing';

            grafo.nodes.push({
                id: link.target,
                name: path.basename(link.target),
                type: tipo
            });
            nodosExistentes.add(link.target);
        }
    });

    return grafo;
}

module.exports = { obtenerGrafo };
