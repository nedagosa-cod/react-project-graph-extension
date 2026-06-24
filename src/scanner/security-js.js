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

function evaluarVulnerabilidadesNPM(deps) {
    const alerts = [];
    for (const [pkg, declaredVersion] of Object.entries(deps)) {
        if (npmVulnerabilidades[pkg]) {
            const rule = npmVulnerabilidades[pkg];
            if (esVersionVulnerable(declaredVersion, rule.maxVulnerable)) {
                alerts.push({
                    package: pkg,
                    declared: declaredVersion,
                    risk: rule.risk
                });
            }
        }
    }
    return alerts;
}

function auditarSeguridadJS(codigo, idArchivo, isRootScan) {
    const securityAlerts = [];
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

    // Variables genéricas
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
                recommendation: `Mueve el valor confidencial a variables de entorno (.env) de forma externa.`
            });
        }
    }

    // Detección de Next.js Server Env en Componentes
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
                    message: `Variable de entorno de servidor 'process.env.${envVar}' expuesta en componente del cliente.`,
                    risk: `Exponer variables sin NEXT_PUBLIC_ incrustará su valor real en el cliente.`,
                    recommendation: `Añádele el prefijo NEXT_PUBLIC_ o muévela al servidor.`
                });
            }
        }
    }

    // Detección de código dinámico XSS
    const dangerousHtmlRegex = /\bdangerouslySetInnerHTML\b/g;
    let dangerousHtmlMatch;
    while ((dangerousHtmlMatch = dangerousHtmlRegex.exec(codigo)) !== null) {
        const { line, snippet } = obtenerDetallesLinea(codigo, dangerousHtmlMatch.index);
        securityAlerts.push({
            type: 'unsafe_smell',
            line,
            snippet,
            message: `Uso detectado de 'dangerouslySetInnerHTML'.`,
            risk: `Riesgo de XSS.`,
            recommendation: `Sanitiza el contenido HTML antes de pasarlo.`
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
            message: `Uso de 'eval()'.`,
            risk: `Riesgo crítico de inyección de código.`,
            recommendation: `Elimina 'eval()'.`
        });
    }

    return securityAlerts;
}

module.exports = { evaluarVulnerabilidadesNPM, auditarSeguridadJS };
