// scanner.js
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export function obtenerGrafo(rutaProyecto) {
    const srcDir = path.join(rutaProyecto, 'src');
    const grafo = {
        nodes: [],
        links: []
    };

    if (!fs.existsSync(srcDir)) {
        return grafo;
    }

    function escanearCarpeta(directorio) {
        const archivos = fs.readdirSync(directorio);

        for (const archivo of archivos) {
            const rutaCompleta = path.join(directorio, archivo);
            const stats = fs.statSync(rutaCompleta);

            if (stats.isDirectory()) {
                escanearCarpeta(rutaCompleta);
            } else if (archivo.endsWith('.js') || archivo.endsWith('.jsx')) {
                procesarArchivo(rutaCompleta);
            }
        }
    }

    function procesarArchivo(rutaArchivo) {
        // Obtenemos la ruta relativa al directorio del proyecto para usar como ID
        const rutaRelativa = path.relative(rutaProyecto, rutaArchivo);
        const idArchivo = rutaRelativa.replace(/\\/g, '/');

        grafo.nodes.push({ id: idArchivo, name: path.basename(rutaArchivo), type: 'local' });

        try {
            const codigo = fs.readFileSync(rutaArchivo, 'utf8');
            const ast = acorn.parse(codigo, { ecmaVersion: 2022, sourceType: 'module' });

            walk.simple(ast, {
                ImportDeclaration(node) {
                    const importPath = node.source.value;
                    let targetId = importPath;

                    // Si el import empieza con '.' es una ruta relativa
                    if (importPath.startsWith('.')) {
                        const contenedorDir = path.dirname(rutaArchivo);
                        const rutaResuelta = path.join(contenedorDir, importPath);
                        const relResuelta = path.relative(rutaProyecto, rutaResuelta);
                        targetId = relResuelta.replace(/\\/g, '/');
                    }

                    grafo.links.push({
                        source: idArchivo,
                        target: targetId
                    });
                }
            });
        } catch (error) {
            console.log(`⚠️ No se pudo analizar el archivo ${idArchivo}: ${error.message}`);
        }
    }

    escanearCarpeta(srcDir);

    // POST-PROCESAMIENTO PARA EVITAR ERRORES D3
    const nodosExistentes = new Set(grafo.nodes.map(n => n.id));

    grafo.links.forEach(link => {
        if (!nodosExistentes.has(link.target)) {
            const esExterno = !link.target.startsWith('src/') && !link.target.startsWith('./src/');
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
