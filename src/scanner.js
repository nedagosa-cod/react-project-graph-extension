// scanner.js
const fs = require('fs');
const path = require('path');

const npmVulnerabilidades = {
    'lodash': { maxVulnerable: '4.17.20', risk: 'Prototype Pollution (CVE-2020-8203) - Se recomienda actualizar a >=4.17.21' },
    'axios': { maxVulnerable: '1.5.1', risk: 'Vulnerabilidad XSS (CVE-2023-45857) - Se recomienda actualizar a >=1.6.0' },
    'jsonwebtoken': { maxVulnerable: '8.5.1', risk: 'Signature Verification Bypass (CVE-2022-23529) - Se recomienda actualizar a >=9.0.0' },
    'qs': { maxVulnerable: '6.5.2', risk: 'Prototype Pollution (CVE-2017-1000048) - Se recomienda actualizar a >=6.5.3' },
    'moment': { maxVulnerable: '2.29.3', risk: 'Regular Expression Denial of Service - ReDoS (CVE-2022-31129) - Se recomienda actualizar a >=2.29.4' },
    'minimist': { maxVulnerable: '1.2.5', risk: 'Prototype Pollution (CVE-2021-3918) - Se recomienda actualizar a >=1.2.6' }
};

function esVersionVulnerable(declaredVersion, maxVulnerable) {
    if (!declaredVersion) return false;
    const cleanDeclared = declaredVersion.replace(/[^0-9.]/g, '');
    if (!cleanDeclared) return false;

    const partsDeclared = cleanDeclared.split('.').map(Number);
    const partsMax = maxVulnerable.split('.').map(Number);

    for (let i = 0; i < Math.max(partsDeclared.length, partsMax.length); i++) {
        const vDeclared = partsDeclared[i] || 0;
        const vMax = partsMax[i] || 0;

        if (vDeclared < vMax) return true;
        if (vDeclared > vMax) return false;
    }
    return true;
}

function obtenerGrafo(rutaProyecto) {
    const srcDir = path.join(rutaProyecto, 'src');
    const grafo = {
        nodes: [],
        links: [],
        npmVulnerabilities: []
    };

    // Auditar package.json
    let packageJsonPath = path.join(rutaProyecto, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        try {
            const items = fs.readdirSync(rutaProyecto);
            for (const item of items) {
                const subPath = path.join(rutaProyecto, item);
                if (fs.statSync(subPath).isDirectory() && !['node_modules', '.git', '.vscode', '.next', 'dist', 'build'].includes(item)) {
                    const candidate = path.join(subPath, 'package.json');
                    if (fs.existsSync(candidate)) {
                        packageJsonPath = candidate;
                        break;
                    }
                }
            }
        } catch (e) {
            // Ignorar errores de lectura
        }
    }
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
            
            for (const [pkg, declaredVersion] of Object.entries(deps)) {
                if (npmVulnerabilidades[pkg]) {
                    const rule = npmVulnerabilidades[pkg];
                    if (esVersionVulnerable(declaredVersion, rule.maxVulnerable)) {
                        grafo.npmVulnerabilities.push({
                            package: pkg,
                            declared: declaredVersion,
                            risk: rule.risk
                        });
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ No se pudo leer package.json en ${rutaProyecto}: ${error.message}`);
        }
    }

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

        let exportName = null;
        let routeInfo = null;
        const securityAlerts = [];
        if (codigo) {
            // 1. Buscar 'export default [async] function Nombre'
            const matchFunction = /export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(codigo);
            if (matchFunction) {
                exportName = matchFunction[1];
            } else {
                // 2. Buscar 'export default class Nombre'
                const matchClass = /export\s+default\s+class\s+([A-Za-z0-9_$]+)/.exec(codigo);
                if (matchClass) {
                    exportName = matchClass[1];
                } else {
                    // 3. Buscar 'export default Nombre' (var, arrow func, etc.)
                    const matchVar = /export\s+default\s+([A-Za-z0-9_$]+)/.exec(codigo);
                    if (matchVar && !['function', 'class', 'const', 'let', 'var', 'async'].includes(matchVar[1])) {
                        exportName = matchVar[1];
                    }
                }
            }

            // Detección de Secretos Hardcodeados
            const awsAccessKeyRegex = /\bAKIA[0-9A-Z]{16}\b/g;
            let awsMatch;
            while ((awsMatch = awsAccessKeyRegex.exec(codigo)) !== null) {
                securityAlerts.push({
                    type: 'secret_leak',
                    message: `Posible fuga de clave de acceso AWS (AWS Access Key ID) detectada.`
                });
            }

            const stripeKeyRegex = /\bsk_(?:live|test)_[0-9a-zA-Z]{24}\b/g;
            let stripeMatch;
            while ((stripeMatch = stripeKeyRegex.exec(codigo)) !== null) {
                securityAlerts.push({
                    type: 'secret_leak',
                    message: `Posible fuga de API Key de Stripe (Secret Key) detectada.`
                });
            }

            const googleKeyRegex = /\bAIza[0-9A-Za-z-_]{35}\b/g;
            let googleMatch;
            while ((googleMatch = googleKeyRegex.exec(codigo)) !== null) {
                securityAlerts.push({
                    type: 'secret_leak',
                    message: `Posible fuga de Google/Firebase API Key detectada.`
                });
            }

            const slackKeyRegex = /\bxox[bapr]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}\b/g;
            let slackMatch;
            while ((slackMatch = slackKeyRegex.exec(codigo)) !== null) {
                securityAlerts.push({
                    type: 'secret_leak',
                    message: `Posible fuga de Slack Token detectada.`
                });
            }

            // Variables de asignación genéricas con nombres críticos (token, secret, key, password)
            const genericKeyRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]*(?:key|secret|token|password|passwd|auth|jwt|credential|private|cert)[a-zA-Z0-9_$]*)\s*=\s*["'`]([^"'`\s$]{8,})["'`]/ig;
            let genericMatch;
            while ((genericMatch = genericKeyRegex.exec(codigo)) !== null) {
                const varName = genericMatch[1];
                const valueMatched = genericMatch[2];
                const lowerVal = valueMatched.toLowerCase();
                const invalidPlaceholders = ['placeholder', 'password', 'passwd', 'secret', 'token', 'my-secret', 'mysecret', 'dummy', 'testkey', 'testsecret', 'jwtsecret', '12345678', 'abcdefgh'];
                if (!invalidPlaceholders.includes(lowerVal) && !valueMatched.includes('${')) {
                    securityAlerts.push({
                        type: 'secret_leak',
                        message: `Posible secreto hardcodeado en la variable '${varName}'.`
                    });
                }
            }

            // Detección de Next.js Server Environment Variables en Componentes del Cliente
            const isClientComponent = codigo.includes('"use client"') || codigo.includes("'use client'");
            if (isClientComponent) {
                const envRegex = /process\.env\.([A-Za-z0-9_]+)/g;
                let envMatch;
                while ((envMatch = envRegex.exec(codigo)) !== null) {
                    const envVar = envMatch[1];
                    if (!envVar.startsWith('NEXT_PUBLIC_') && envVar !== 'NODE_ENV') {
                        securityAlerts.push({
                            type: 'unsafe_env',
                            message: `Variable de entorno de servidor 'process.env.${envVar}' expuesta en componente de cliente ('use client').`
                        });
                    }
                }
            }

            // Detección de Funciones Inseguras y Smells de Inyección (XSS / Código Dinámico)
            if (/\bdangerouslySetInnerHTML\b/.test(codigo)) {
                securityAlerts.push({
                    type: 'unsafe_smell',
                    message: `Uso de 'dangerouslySetInnerHTML' detectado (Riesgo potencial de Cross-Site Scripting - XSS si el contenido no se sanitiza).`
                });
            }

            if (/\beval\s*\(/.test(codigo)) {
                securityAlerts.push({
                    type: 'unsafe_smell',
                    message: `Uso de 'eval()' detectado (Ejecución de código arbitrario altamente insegura).`
                });
            }

            if (/\bnew\s+Function\s*\(/.test(codigo)) {
                securityAlerts.push({
                    type: 'unsafe_smell',
                    message: `Constructor 'new Function()' detectado (Ejecución de código dinámica e insegura).`
                });
            }

            if (/\bdocument\.write(?:ln)?\s*\(/.test(codigo)) {
                securityAlerts.push({
                    type: 'unsafe_smell',
                    message: `Uso de 'document.write()' detectado (Práctica obsoleta e insegura de inyección DOM).`
                });
            }

            const timerRegex = /\b(setTimeout|setInterval)\s*\(\s*["'`]/g;
            let timerMatch;
            while ((timerMatch = timerRegex.exec(codigo)) !== null) {
                securityAlerts.push({
                    type: 'unsafe_smell',
                    message: `Llamada a '${timerMatch[1]}' con un string literal (Funciona como eval e incrementa riesgos de inyección).`
                });
            }

            // Mapeo de Superficie de Ataque de Next.js (page.tsx y route.ts)
            const lowerName = path.basename(rutaArchivo).toLowerCase();
            const isPage = lowerName.startsWith('page.');
            const isRoute = lowerName.startsWith('route.');
            
            if (isPage || isRoute) {
                const routeType = isPage ? 'page' : 'api';
                const idLower = idArchivo.toLowerCase();
                
                // Buscar si tiene chequeos de autenticación directos
                const authPattern = /\b(auth|session|user|login|getServerSession|useSession|authenticate|requireAuth|currentUser|jwt|token)\b/i;
                const hasDirectAuth = authPattern.test(codigo);
                
                // Determinar si es una ruta pública conocida
                const publicPaths = ['/login/', '/public/', '/register/', '/signup/', '/recovery/', 'forgot-password'];
                const isPublicPath = publicPaths.some(p => idLower.includes(p));
                
                let status = 'exposed';
                if (isPublicPath) {
                    status = 'public';
                } else if (hasDirectAuth) {
                    status = 'protected';
                }
                
                routeInfo = {
                    isRoute: true,
                    routeType,
                    status
                };
                
                if (status === 'exposed') {
                    securityAlerts.push({
                        type: 'route_exposure',
                        message: `Superficie de Ataque: Ruta expuesta sin chequeo de autenticación en este archivo. Asegúrate de protegerla en middleware.ts.`
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

            // Verificar si es una dependencia externa vulnerable de package.json
            let hasSecurity = false;
            let securityAlerts = null;
            if (tipo === 'external') {
                const foundVulnerability = grafo.npmVulnerabilities.find(v => v.package === link.target);
                if (foundVulnerability) {
                    hasSecurity = true;
                    securityAlerts = [{
                        type: 'npm_vulnerability',
                        message: `Dependencia crítica '${foundVulnerability.package}' (${foundVulnerability.declared}) vulnerable: ${foundVulnerability.risk}`
                    }];
                }
            }

            grafo.nodes.push({
                id: link.target,
                name: path.basename(link.target),
                type: tipo,
                ext: ext,
                hasSecurity: hasSecurity,
                securityAlerts: securityAlerts,
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
