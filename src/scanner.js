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
        npmVulnerabilities: [],
        techStack: {
            framework: 'React (Cliente)',
            stateLocal: 'React State / Context',
            stateServer: 'Fetch API / Nativo',
            validation: 'Ninguno (JS nativo)',
            styling: 'CSS nativo',
            forms: 'Formularios nativos',
            uiComponents: 'Ninguno'
        }
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
            
            // Frameworks
            if (deps['next']) grafo.techStack.framework = `Next.js (${deps['next']})`;
            else if (deps['react-native']) grafo.techStack.framework = `React Native (${deps['react-native']})`;
            else if (deps['vite']) grafo.techStack.framework = `Vite + React`;
            
            // State Local
            if (deps['zustand']) grafo.techStack.stateLocal = `Zustand (${deps['zustand']})`;
            else if (deps['@reduxjs/toolkit'] || deps['redux']) grafo.techStack.stateLocal = `Redux Toolkit / Redux`;
            else if (deps['jotai']) grafo.techStack.stateLocal = `Jotai (${deps['jotai']})`;
            else if (deps['recoil']) grafo.techStack.stateLocal = `Recoil (${deps['recoil']})`;
            else if (deps['mobx']) grafo.techStack.stateLocal = `MobX`;
            
            // State Server / Fetching
            if (deps['@tanstack/react-query'] || deps['react-query']) grafo.techStack.stateServer = `TanStack Query (React Query)`;
            else if (deps['swr']) grafo.techStack.stateServer = `SWR (${deps['swr']})`;
            else if (deps['@apollo/client']) grafo.techStack.stateServer = `Apollo Client (GraphQL)`;
            else if (deps['axios']) grafo.techStack.stateServer = `Axios (${deps['axios']})`;
            
            // Validación / Schemas
            if (deps['zod']) grafo.techStack.validation = `Zod (${deps['zod']})`;
            else if (deps['yup']) grafo.techStack.validation = `Yup (${deps['yup']})`;
            else if (deps['joi']) grafo.techStack.validation = `Joi`;
            else if (deps['typescript']) grafo.techStack.validation = `TypeScript (${deps['typescript']})`;
            
            // Estilos
            const stylesList = [];
            if (deps['tailwindcss']) stylesList.push(`TailwindCSS (${deps['tailwindcss']})`);
            if (deps['styled-components']) stylesList.push(`Styled Components`);
            if (deps['@emotion/react']) stylesList.push(`Emotion`);
            if (deps['sass']) stylesList.push(`Sass`);
            if (stylesList.length > 0) grafo.techStack.styling = stylesList.join(', ');
            
            // Formularios
            if (deps['react-hook-form']) grafo.techStack.forms = `React Hook Form (${deps['react-hook-form']})`;
            else if (deps['formik']) grafo.techStack.forms = `Formik`;
            
            // Componentes UI
            const uiList = [];
            if (deps['@mui/material']) uiList.push('Material UI');
            if (deps['antd']) uiList.push('Ant Design');
            if (deps['@radix-ui/react-primitive'] || deps['@radix-ui/react-dialog']) uiList.push('Radix UI');
            if (deps['framer-motion']) uiList.push('Framer Motion');
            if (deps['lucide-react']) uiList.push('Lucide Icons');
            if (uiList.length > 0) grafo.techStack.uiComponents = uiList.join(', ');

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

            const obtenerDetallesLinea = (codigo, index) => {
                const subStr = codigo.substring(0, index);
                const line = subStr.split('\n').length;
                const snippet = codigo.split('\n')[line - 1].trim();
                return { line, snippet };
            };

            // Detección de Secretos Hardcodeados
            const awsAccessKeyRegex = /\bAKIA[0-9A-Z]{16}\b/g;
            let awsMatch;
            while ((awsMatch = awsAccessKeyRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, awsMatch.index);
                securityAlerts.push({
                    type: 'secret_leak',
                    line,
                    snippet,
                    message: `Clave de acceso de AWS expuesta (AWS Access Key ID).`,
                    risk: `Las credenciales de AWS hardcodeadas en el código fuente pueden ser robadas por atacantes o expuestas en repositorios públicos, dando acceso total o parcial a tus recursos en la nube.`,
                    recommendation: `Mueve esta clave a un archivo de configuración de variables de entorno (.env) o usa servicios de gestión de secretos como AWS Secrets Manager, y asegúrate de añadir el archivo .env a tu .gitignore.`
                });
            }

            const stripeKeyRegex = /\bsk_(?:live|test)_[0-9a-zA-Z]{24}\b/g;
            let stripeMatch;
            while ((stripeMatch = stripeKeyRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, stripeMatch.index);
                securityAlerts.push({
                    type: 'secret_leak',
                    line,
                    snippet,
                    message: `API Key secreta de Stripe expuesta.`,
                    risk: `El uso de claves secretas ('sk_') de Stripe expuestas en el código fuente permite a cualquier persona interactuar con tu cuenta de Stripe (crear cargos, reembolsos, etc.), comprometiendo tus fondos y la seguridad financiera de tu aplicación.`,
                    recommendation: `Usa variables de entorno del sistema o archivos .env no integrados en el control de versiones para cargar la clave de Stripe de forma dinámica en el servidor.`
                });
            }

            const googleKeyRegex = /\bAIza[0-9A-Za-z-_]{35}\b/g;
            let googleMatch;
            while ((googleMatch = googleKeyRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, googleMatch.index);
                securityAlerts.push({
                    type: 'secret_leak',
                    line,
                    snippet,
                    message: `Clave de API de Google / Firebase expuesta.`,
                    risk: `Aunque algunas API keys de Firebase y Google Maps están diseñadas para uso en el cliente, exponer claves con permisos excesivos sin restricciones de origen (HTTP referrer) o de IPs permite a terceros consumirlas, generando costos imprevistos o acceso a datos de tus servicios de Google Cloud.`,
                    recommendation: `Asegúrate de restringir esta API Key en la consola de Google Cloud Console (restringir por origen HTTP o tipo de API) y considera no harcodeala directamente si es una clave con permisos de escritura o administrativos.`
                });
            }

            const slackKeyRegex = /\bxox[bapr]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}\b/g;
            let slackMatch;
            while ((slackMatch = slackKeyRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, slackMatch.index);
                securityAlerts.push({
                    type: 'secret_leak',
                    line,
                    snippet,
                    message: `Token de Slack detectado en el código fuente.`,
                    risk: `Permite a usuarios no autorizados leer mensajes, publicar en canales o ejecutar acciones administrativas en tu espacio de trabajo de Slack, violando la privacidad corporativa.`,
                    recommendation: `Mueve este token a variables de entorno confidenciales en el servidor y restringe el acceso al canal.`
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
                    const { line, snippet } = obtenerDetallesLinea(codigo, genericMatch.index);
                    securityAlerts.push({
                        type: 'secret_leak',
                        line,
                        snippet,
                        message: `Posible secreto hardcodeado en la variable '${varName}'.`,
                        risk: `Almacenar secretos, tokens de autenticación o contraseñas en variables estáticas en el código facilita su descubrimiento mediante ingeniería inversa o análisis del historial del repositorio de código.`,
                        recommendation: `Mueve el valor confidencial a variables de entorno (.env) de forma externa. Por ejemplo: const ${varName} = process.env.${varName.toUpperCase()};`
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
                        const { line, snippet } = obtenerDetallesLinea(codigo, envMatch.index);
                        securityAlerts.push({
                            type: 'unsafe_env',
                            line,
                            snippet,
                            message: `Variable de entorno de servidor 'process.env.${envVar}' expuesta en componente del cliente ('use client').`,
                            risk: `En Next.js, las variables de entorno sin el prefijo 'NEXT_PUBLIC_' están reservadas para el servidor. Usarlas en un componente del cliente ('use client') causará que Next.js incruste su valor real en los archivos de JavaScript estáticos que se envían al navegador del usuario, exponiendo claves secretas.`,
                            recommendation: `Si esta variable es pública, añádele el prefijo 'NEXT_PUBLIC_${envVar}'. Si es confidencial (como una clave de API secreta), muévela a una Server Action o a una API Route en el servidor.`
                        });
                    }
                }
            }

            // Detección de Funciones Inseguras y Smells de Inyección (XSS / Código Dinámico)
            const dangerousHtmlRegex = /\bdangerouslySetInnerHTML\b/g;
            let dangerousHtmlMatch;
            while ((dangerousHtmlMatch = dangerousHtmlRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, dangerousHtmlMatch.index);
                securityAlerts.push({
                    type: 'unsafe_smell',
                    line,
                    snippet,
                    message: `Uso detectado de 'dangerouslySetInnerHTML'.`,
                    risk: `Esta propiedad de React inserta HTML sin sanitizar directamente en el DOM. Si los datos provienen de entradas del usuario, APIs externas o fuentes no confiables, un atacante podría inyectar scripts maliciosos (XSS) que robarían sesiones de usuario o cookies.`,
                    recommendation: `Sanitiza el contenido HTML antes de pasarlo a dangerouslySetInnerHTML utilizando una librería de confianza como 'dompurify' (por ejemplo: DOMPurify.sanitize(dirtyHtml)).`
                });
            }

            const evalRegex = /\beval\s*\(/g;
            let evalMatch;
            while ((evalMatch = evalRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, evalMatch.index);
                securityAlerts.push({
                    type: 'unsafe_smell',
                    line,
                    snippet,
                    message: `Uso detectado de la función extremadamente insegura 'eval()'.`,
                    risk: `La función 'eval()' ejecuta un string como código JavaScript dentro del contexto local. Si se pasa cualquier entrada influenciada por el usuario o de fuentes externas a eval(), se permite la Ejecución Remota de Código (RCE) en el cliente. Además, eval() destruye las optimizaciones del compilador JS y afecta gravemente al rendimiento.`,
                    recommendation: `Elimina por completo el uso de 'eval()'. Utiliza estructuras de control de flujo seguras (como diccionarios de funciones o JSON.parse si estás deserializando datos).`
                });
            }

            const newFunctionRegex = /\bnew\s+Function\s*\(/g;
            let newFunctionMatch;
            while ((newFunctionMatch = newFunctionRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, newFunctionMatch.index);
                securityAlerts.push({
                    type: 'unsafe_smell',
                    line,
                    snippet,
                    message: `Constructor dinámico 'new Function()' detectado.`,
                    risk: `Al igual que 'eval()', el constructor de funciones dinámicas 'new Function(code)' compila y ejecuta código en tiempo de ejecución, abriendo vulnerabilidades graves de inyección de código si el string recibido contiene variables dinámicas externas.`,
                    recommendation: `Evita la generación de funciones a partir de strings. Reescribe la lógica usando funciones estándar de JS o callbacks estructurados.`
                });
            }

            const docWriteRegex = /\bdocument\.write(?:ln)?\s*\(/g;
            let docWriteMatch;
            while ((docWriteMatch = docWriteRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, docWriteMatch.index);
                securityAlerts.push({
                    type: 'unsafe_smell',
                    line,
                    snippet,
                    message: `Uso obsoleto e inseguro de 'document.write()'.`,
                    risk: `Esta llamada inyecta código directamente al buffer de renderizado del DOM de forma síncrona. Además de causar problemas de inyección XSS, puede bloquear la carga de la página web entera en conexiones lentas y está desaconsejada en la especificación moderna de HTML.`,
                    recommendation: `Reemplaza 'document.write()' usando manipulación de DOM moderna de React (modificar el estado para renderizar componentes) o métodos seguros nativos como 'document.createElement' y 'element.textContent'.`
                });
            }

            const timerRegex = /\b(setTimeout|setInterval)\s*\(\s*["'`]/g;
            let timerMatch;
            while ((timerMatch = timerRegex.exec(codigo)) !== null) {
                const { line, snippet } = obtenerDetallesLinea(codigo, timerMatch.index);
                securityAlerts.push({
                    type: 'unsafe_smell',
                    line,
                    snippet,
                    message: `Llamada a '${timerMatch[1]}' utilizando un string literal de código.`,
                    risk: `Pasar un string en lugar de una función callback a setTimeout/setInterval (por ejemplo: setTimeout("alert(1)", 100)) obliga al motor de JavaScript a interpretar dinámicamente el string usando la función 'eval()', lo que hereda todos los riesgos de inyección y lentitud de esta última.`,
                    recommendation: `Pasa siempre una función callback anónima o una referencia a función directa. Ejemplo: setTimeout(() => alert(1), 100).`
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
                        message: `Ruta de Next.js expuesta de manera pública en este archivo.`,
                        risk: `Este archivo representa una página o endpoint de API que no contiene referencias visibles o directas a comprobaciones de autenticación o sesión (como getServerSession, useSession, etc.). Si esta ruta expone datos confidenciales, cualquier usuario anónimo podría acceder a ella.`,
                        recommendation: `Asegúrate de que esta ruta esté protegida de forma centralizada en tu archivo 'middleware.ts', o bien implementa una verificación de sesión directa en este archivo antes de retornar datos o JSX.`
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
                        message: `Vulnerabilidad detectada en dependencia npm: '${foundVulnerability.package}' (${foundVulnerability.declared})`,
                        risk: foundVulnerability.risk,
                        recommendation: `Actualiza la dependencia '${foundVulnerability.package}' en tu 'package.json' a la versión recomendada y ejecuta 'npm install' o 'pnpm install' para aplicar los cambios.`
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
