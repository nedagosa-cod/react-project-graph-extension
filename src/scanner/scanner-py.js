const fs = require('fs');
const path = require('path');
const { resolverRuta } = require('./file-system');
const { auditarSeguridadPy } = require('./security-py');

function clasificarCapaPy(idArchivo) {
    const pathLower = idArchivo.toLowerCase();
    const baseName = path.basename(idArchivo).toLowerCase();
    
    // 1. Models / Entities / Domain
    if (
        pathLower.includes('/models') || pathLower.includes('/entities') || 
        baseName === 'models.py' || baseName === 'schemas.py' || baseName === 'entities.py'
    ) {
        return 'models';
    }
    
    // 2. Routers / Views / Controllers (Presentación/API)
    if (
        pathLower.includes('/routers') || pathLower.includes('/views') || pathLower.includes('/controllers') || pathLower.includes('/api') ||
        baseName === 'views.py' || baseName === 'urls.py' || baseName === 'routers.py' || baseName === 'controllers.py'
    ) {
        return 'routers';
    }
    
    // 3. Services / Logic / Use Cases
    if (
        pathLower.includes('/services') || pathLower.includes('/usecases') || pathLower.includes('/use_cases') || pathLower.includes('/logic') ||
        baseName === 'services.py' || baseName === 'use_cases.py'
    ) {
        return 'services';
    }
    
    // 4. Infra / Utils / Repositories
    if (
        pathLower.includes('/utils') || pathLower.includes('/infra') || pathLower.includes('/repositories') || pathLower.includes('/core') || pathLower.includes('/config') ||
        baseName === 'utils.py' || baseName === 'database.py' || baseName === 'config.py' || baseName === 'settings.py' || baseName === 'admin.py' || baseName === 'apps.py'
    ) {
        return 'infra';
    }
    
    return 'presentation'; // Default layer fallback
}

function resolverRutaPy(rutaProyecto, rutaBase, importPath) {
    // Convierte module.submodule en module/submodule
    const modulePath = importPath.replace(/\./g, '/');
    
    // Intentar resolver asumiendo que es absoluto desde la raíz del proyecto
    const candidatos = [
        path.join(rutaProyecto, modulePath + '.py'),
        path.join(rutaProyecto, modulePath, '__init__.py')
    ];

    for (const candidato of candidatos) {
        if (fs.existsSync(candidato) && fs.statSync(candidato).isFile()) {
            return path.relative(rutaProyecto, candidato).replace(/\\/g, '/');
        }
    }
    
    // Intentar relativo (si comienza con . en Python, from .module import)
    // Para simplificar, devolvemos el importPath si no encontramos el archivo, 
    // y el motor genérico lo marcará como external/missing
    return importPath;
}

function procesarArchivoPy(rutaProyecto, rutaArchivo, tamañoArchivo, grafo, isRootScan) {
    const rutaRelativa = path.relative(rutaProyecto, rutaArchivo);
    const idArchivo = rutaRelativa.replace(/\\/g, '/');
    const ext = path.extname(rutaArchivo).toLowerCase();
    const capa = clasificarCapaPy(idArchivo);

    let lineas = 0;
    let codigo = '';
    try {
        codigo = fs.readFileSync(rutaArchivo, 'utf8');
        lineas = codigo.split('\n').length;
    } catch (error) {
        console.log(`⚠️ No se pudo leer el archivo ${idArchivo}: ${error.message}`);
        return;
    }

    let exportName = null;
    let routeInfo = null;
    let securityAlerts = [];

    if (codigo) {
        // En Python no hay 'export default', pero podemos capturar la primera clase o función principal
        const classMatch = /^class\s+([A-Za-z0-9_]+)/m.exec(codigo);
        if (classMatch) {
            exportName = classMatch[1];
        } else {
            const defMatch = /^def\s+([A-Za-z0-9_]+)/m.exec(codigo);
            if (defMatch) {
                exportName = defMatch[1];
            }
        }

        securityAlerts = auditarSeguridadPy(codigo, idArchivo);

        // Mapeo rudimentario de exposición de rutas para Python (Django / FastAPI / Flask)
        const lowerName = path.basename(rutaArchivo).toLowerCase();
        if (lowerName === 'views.py' || lowerName === 'urls.py' || lowerName === 'routers.py' || codigo.includes('@app.route') || codigo.includes('@router.')) {
            const authPattern = /\b(login_required|Depends\(get_current_user\)|IsAuthenticated|permission_classes)\b/i;
            const hasAuth = authPattern.test(codigo);
            
            routeInfo = {
                isRoute: true,
                routeType: 'api',
                status: hasAuth ? 'protected' : 'exposed'
            };
        }
    }

    grafo.nodes.push({ 
        id: idArchivo, 
        name: path.basename(rutaArchivo), 
        type: 'local', 
        size: tamañoArchivo,
        ext: ext,
        lines: lineas,
        exportName: exportName || null,
        securityAlerts: securityAlerts.length > 0 ? securityAlerts : null,
        hasSecurity: securityAlerts.length > 0,
        routeInfo: routeInfo || null,
        layer: capa
    });

    try {
        if (codigo) {
            // Eliminar comentarios (en Python #) y strings multilinea """..."""
            const codigoLimpio = codigo.replace(/#.*$/gm, '').replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
            const importsEncontrados = [];

            // import module
            // import module1, module2
            const importRegex = /^import\s+([a-zA-Z0-9_.,\s]+)/gm;
            let match;
            while ((match = importRegex.exec(codigoLimpio)) !== null) {
                const modules = match[1].split(',').map(s => s.trim().split(' ')[0]); // ignora 'as alias'
                importsEncontrados.push(...modules);
            }

            // from module import something
            const fromImportRegex = /^from\s+([a-zA-Z0-9_.]+)\s+import/gm;
            while ((match = fromImportRegex.exec(codigoLimpio)) !== null) {
                importsEncontrados.push(match[1]);
            }

            const contenedorDir = path.dirname(rutaArchivo);
            
            for (const importPath of importsEncontrados) {
                if (!importPath) continue;
                
                const targetId = resolverRutaPy(rutaProyecto, contenedorDir, importPath);
                
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

module.exports = { procesarArchivoPy };
