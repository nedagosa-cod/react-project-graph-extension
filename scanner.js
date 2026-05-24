// scanner.js
const fs = require('fs');
const path = require('path');

function obtenerGrafo(rutaProyecto) {
    const srcDir = path.join(rutaProyecto, 'src');
    const grafo = {
        nodes: [],
        links: []
    };

    let startDir = srcDir;
    let isRootScan = false;
    if (!fs.existsSync(srcDir)) {
        // Si no existe 'src', buscamos si existe 'app' o 'pages' en la raíz, o usamos la raíz del proyecto
        startDir = rutaProyecto;
        isRootScan = true;
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
        const baseName = path.basename(directorio);
        // Excluir carpetas pesadas del sistema, dependencias y builds
        if ([
            'node_modules', '.git', '.next', 'dist', 'build', 'out', 
            '.vscode', '.idea', 'public', '.agents', '.gemini'
        ].includes(baseName)) {
            return;
        }

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
                // Evitar procesar archivos de configuración en la raíz del proyecto
                if (isRootScan && directorio === rutaProyecto) {
                    if (archivo.includes('.config.') || archivo === 'eslint.config.js') {
                        continue;
                    }
                }
                procesarArchivo(rutaCompleta, stats.size);
            }
        }
    }

    function clasificarCapa(idArchivo) {
        const pathLower = idArchivo.toLowerCase();
        
        // 1. Dominio (Tipos/Modelos/Interfaces)
        if (
            pathLower.includes('/types/') || pathLower.includes('/models/') || 
            pathLower.includes('/interfaces/') || pathLower.includes('/domain/') ||
            pathLower.endsWith('/types') || pathLower.endsWith('/models') || 
            pathLower.endsWith('/interfaces') || pathLower.endsWith('/domain')
        ) {
            return 'domain';
        }
        
        // 2. Infraestructura (Datos/API/Utils/Services/Repositories)
        if (
            pathLower.includes('/services/') || pathLower.includes('/api/') || 
            pathLower.includes('/app/api/') || pathLower.includes('/pages/api/') ||
            pathLower.includes('/utils/') || pathLower.includes('/infra/') ||
            pathLower.includes('/repositories/') || pathLower.includes('/data/') ||
            pathLower.endsWith('/services') || pathLower.endsWith('/api') || 
            pathLower.endsWith('/utils') || pathLower.endsWith('/infra') ||
            pathLower.endsWith('/repositories') || pathLower.endsWith('/data')
        ) {
            return 'data';
        }
        
        // 3. Aplicación (Custom Hooks)
        const baseName = path.basename(idArchivo).toLowerCase();
        if (
            pathLower.includes('/hooks/') || pathLower.endsWith('/hooks') || 
            baseName.startsWith('use')
        ) {
            return 'hooks';
        }
        
        // 4. Negocio (Estado/Contexto/Store/Redux/Slices)
        if (
            pathLower.includes('/context/') || pathLower.includes('/store/') || 
            pathLower.includes('/redux/') || pathLower.includes('/slices/') ||
            pathLower.includes('/state/') || pathLower.includes('/logic/') ||
            pathLower.endsWith('/context') || pathLower.endsWith('/store') || 
            pathLower.endsWith('/redux') || pathLower.endsWith('/slices') ||
            pathLower.endsWith('/state') || pathLower.endsWith('/logic')
        ) {
            return 'logic';
        }
        
        // 5. Presentación (UI/Componentes/Vistas/Páginas)
        return 'presentation';
    }

    function procesarArchivo(rutaArchivo, tamañoArchivo) {
        const rutaRelativa = path.relative(rutaProyecto, rutaArchivo);
        const idArchivo = rutaRelativa.replace(/\\/g, '/');
        const ext = path.extname(rutaArchivo).toLowerCase();
        const capa = clasificarCapa(idArchivo);

        let lineas = 0;
        let codigo = '';
        try {
            codigo = fs.readFileSync(rutaArchivo, 'utf8');
            lineas = codigo.split('\n').length;
        } catch (error) {
            console.log(`⚠️ No se pudo leer el archivo ${idArchivo}: ${error.message}`);
        }

        grafo.nodes.push({ 
            id: idArchivo, 
            name: path.basename(rutaArchivo), 
            type: 'local', 
            size: tamañoArchivo,
            ext: ext,
            lines: lineas,
            layer: capa
        });

        try {
            if (codigo) {
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
            }
        } catch (error) {
            console.log(`⚠️ No se pudo analizar el archivo ${idArchivo}: ${error.message}`);
        }
    }

    escanearCarpeta(startDir);

    // POST-PROCESAMIENTO PARA EVITAR ERRORES D3 Y AGREGAR NODOS EXTERNOS/FALTANTES/ASSETS
    const nodosExistentes = new Set(grafo.nodes.map(n => n.id));

    grafo.links.forEach(link => {
        if (!nodosExistentes.has(link.target)) {
            const ext = path.extname(link.target).toLowerCase();
            const esExterno = !link.target.startsWith('src/') && !link.target.startsWith('./src/');
            
            let tipo = 'missing';
            if (esExterno) {
                tipo = 'external';
            } else if (['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.json', '.html'].includes(ext)) {
                tipo = 'asset';
            }

            grafo.nodes.push({
                id: link.target,
                name: path.basename(link.target),
                type: tipo,
                ext: ext,
                layer: tipo
            });
            nodosExistentes.add(link.target);
        }
    });

    // AUDITORÍA DE ENLACES PARA ARQUITECTURA LIMPIA
    const mapaNodos = {};
    grafo.nodes.forEach(n => {
        mapaNodos[n.id] = n;
    });

    const jerarquiaCapas = {
        'domain': 1,
        'data': 2,
        'hooks': 3,
        'logic': 4,
        'presentation': 5
    };

    grafo.links.forEach(link => {
        const nodoSource = mapaNodos[link.source];
        const nodoTarget = mapaNodos[link.target];

        if (nodoSource && nodoTarget) {
            const capaSource = nodoSource.layer;
            const capaTarget = nodoTarget.layer;

            if (jerarquiaCapas[capaSource] && jerarquiaCapas[capaTarget]) {
                const rangoSource = jerarquiaCapas[capaSource];
                const rangoTarget = jerarquiaCapas[capaTarget];

                if (rangoTarget > rangoSource) {
                    link.violation = true;
                    link.violationDetails = `Infracción: '${nodoSource.name}' (${capaSource}) importa '${nodoTarget.name}' (${capaTarget})`;
                }
            }
        }
    });

    // DETECCIÓN DE DEPENDENCIAS CIRCULARES (DFS)
    const adj = {};
    grafo.nodes.forEach(n => {
        adj[n.id] = [];
    });
    grafo.links.forEach(l => {
        const s = l.source;
        const t = l.target;
        if (adj[s]) {
            adj[s].push(t);
        }
    });

    const visitados = {};
    const pilaRecursion = [];
    const ciclosEncontrados = [];

    function buscarCiclos(nodeId) {
        visitados[nodeId] = 'visitando';
        pilaRecursion.push(nodeId);

        const vecinos = adj[nodeId] || [];
        for (const vecino of vecinos) {
            if (visitados[vecino] === 'visitando') {
                const index = pilaRecursion.indexOf(vecino);
                if (index !== -1) {
                    const rutaCiclo = pilaRecursion.slice(index);
                    rutaCiclo.push(vecino);
                    
                    const claveCiclo = rutaCiclo.join(' -> ');
                    const yaExiste = ciclosEncontrados.some(c => c.join(' -> ') === claveCiclo);
                    if (!yaExiste) {
                        ciclosEncontrados.push(rutaCiclo);
                    }
                }
            } else if (!visitados[vecino]) {
                buscarCiclos(vecino);
            }
        }

        pilaRecursion.pop();
        visitados[nodeId] = 'visitado';
    }

    Object.keys(adj).forEach(nodeId => {
        if (!visitados[nodeId]) {
            buscarCiclos(nodeId);
        }
    });

    grafo.cycles = ciclosEncontrados;

    grafo.nodes.forEach(n => {
        n.inCycle = false;
        n.cycles = [];
    });

    ciclosEncontrados.forEach((ciclo, idxCiclo) => {
        for (let i = 0; i < ciclo.length - 1; i++) {
            const nodeId = ciclo[i];
            const nodo = mapaNodos[nodeId];
            if (nodo) {
                nodo.inCycle = true;
                nodo.cycles.push({
                    index: idxCiclo,
                    path: ciclo
                });
            }
        }
    });

    grafo.links.forEach(link => {
        link.inCycle = false;
        link.cycles = [];

        ciclosEncontrados.forEach((ciclo, idxCiclo) => {
            for (let i = 0; i < ciclo.length - 1; i++) {
                const s = ciclo[i];
                const t = ciclo[i + 1];
                if (link.source === s && link.target === t) {
                    link.inCycle = true;
                    link.cycles.push(idxCiclo);
                }
            }
        });
    });

    return grafo;
}

module.exports = { obtenerGrafo };
