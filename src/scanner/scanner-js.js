const fs = require('fs');
const path = require('path');
const { resolverRuta } = require('./file-system');
const { auditarSeguridadJS } = require('./security-js');

function clasificarCapaJS(idArchivo) {
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

function procesarArchivoJS(rutaProyecto, rutaArchivo, tamañoArchivo, grafo, isRootScan) {
    const rutaRelativa = path.relative(rutaProyecto, rutaArchivo);
    const idArchivo = rutaRelativa.replace(/\\/g, '/');
    const ext = path.extname(rutaArchivo).toLowerCase();
    const capa = clasificarCapaJS(idArchivo);

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
        // Buscar export default
        const matchFunction = /export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(codigo);
        if (matchFunction) {
            exportName = matchFunction[1];
        } else {
            const matchClass = /export\s+default\s+class\s+([A-Za-z0-9_$]+)/.exec(codigo);
            if (matchClass) {
                exportName = matchClass[1];
            } else {
                const matchVar = /export\s+default\s+([A-Za-z0-9_$]+)/.exec(codigo);
                if (matchVar && !['function', 'class', 'const', 'let', 'var', 'async'].includes(matchVar[1])) {
                    exportName = matchVar[1];
                }
            }
        }

        securityAlerts = auditarSeguridadJS(codigo, idArchivo, isRootScan);

        // Mapeo de Superficie de Ataque de Next.js
        const lowerName = path.basename(rutaArchivo).toLowerCase();
        const isPage = lowerName.startsWith('page.');
        const isRoute = lowerName.startsWith('route.');
        
        if (isPage || isRoute) {
            const routeType = isPage ? 'page' : 'api';
            const idLower = idArchivo.toLowerCase();
            const authPattern = /\b(auth|session|user|login|getServerSession|useSession|authenticate|requireAuth|currentUser|jwt|token)\b/i;
            const hasDirectAuth = authPattern.test(codigo);
            const publicPaths = ['/login/', '/public/', '/register/', '/signup/', '/recovery/', 'forgot-password'];
            const isPublicPath = publicPaths.some(p => idLower.includes(p));
            
            let status = 'exposed';
            if (isPublicPath) status = 'public';
            else if (hasDirectAuth) status = 'protected';
            
            routeInfo = { isRoute: true, routeType, status };
            
            if (status === 'exposed') {
                securityAlerts.push({
                    type: 'route_exposure',
                    message: `Ruta de Next.js expuesta de manera pública en este archivo.`,
                    risk: `Este archivo representa una página o endpoint de API que no contiene referencias visibles o directas a comprobaciones de sesión.`,
                    recommendation: `Asegúrate de que esta ruta esté protegida en tu 'middleware.ts', o bien implementa una verificación de sesión.`
                });
            }
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
            const codigoLimpio = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
            const importsEncontrados = [];

            const importRegex = /import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
            let match;
            while ((match = importRegex.exec(codigoLimpio)) !== null) { importsEncontrados.push(match[1]); }

            const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
            while ((match = dynamicImportRegex.exec(codigoLimpio)) !== null) { importsEncontrados.push(match[1]); }

            const exportFromRegex = /export\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
            while ((match = exportFromRegex.exec(codigoLimpio)) !== null) { importsEncontrados.push(match[1]); }

            const contenedorDir = path.dirname(rutaArchivo);
            const extensionesJS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
            
            for (const importPath of importsEncontrados) {
                const targetId = resolverRuta(rutaProyecto, contenedorDir, importPath, extensionesJS);
                
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

module.exports = { procesarArchivoJS };
