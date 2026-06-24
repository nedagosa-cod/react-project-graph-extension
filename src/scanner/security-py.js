function auditarSeguridadPy(codigo, idArchivo) {
    const securityAlerts = [];
    const obtenerDetallesLinea = (codigo, index) => {
        const subStr = codigo.substring(0, index);
        const line = subStr.split('\n').length;
        const snippet = codigo.split('\n')[line - 1].trim();
        return { line, snippet };
    };

    // Detección de Secretos Hardcodeados
    const genericKeyRegex = /(?:([a-zA-Z0-9_$]*(?:key|secret|token|password|passwd|auth|jwt|credential|private|cert)[a-zA-Z0-9_$]*))\s*=\s*["']([^"'`\s$]{8,})["']/ig;
    let genericMatch;
    while ((genericMatch = genericKeyRegex.exec(codigo)) !== null) {
        const varName = genericMatch[1];
        const valueMatched = genericMatch[2];
        const lowerVal = valueMatched.toLowerCase();
        const invalidPlaceholders = ['placeholder', 'password', 'passwd', 'secret', 'token', 'my-secret', 'mysecret', 'dummy', 'testkey', 'testsecret', 'jwtsecret', '12345678', 'abcdefgh'];
        if (!invalidPlaceholders.includes(lowerVal) && !valueMatched.includes('{')) {
            const { line, snippet } = obtenerDetallesLinea(codigo, genericMatch.index);
            securityAlerts.push({
                type: 'secret_leak',
                line,
                snippet,
                message: `Posible secreto hardcodeado en la variable '${varName}'.`,
                risk: `Almacenar secretos o contraseñas en variables estáticas en el código facilita su descubrimiento.`,
                recommendation: `Mueve el valor confidencial a variables de entorno (ej. os.environ.get('${varName}')).`
            });
        }
    }

    // Detección de eval() y exec()
    const evalRegex = /\b(eval|exec)\s*\(/g;
    let evalMatch;
    while ((evalMatch = evalRegex.exec(codigo)) !== null) {
        const { line, snippet } = obtenerDetallesLinea(codigo, evalMatch.index);
        securityAlerts.push({
            type: 'unsafe_smell',
            line,
            snippet,
            message: `Uso de la función insegura '${evalMatch[1]}()'.`,
            risk: `Riesgo crítico de Ejecución Remota de Código (RCE) si procesa entradas de usuario.`,
            recommendation: `Utiliza 'ast.literal_eval' o evita ejecutar código dinámico.`
        });
    }

    // Detección de pickle.loads() / yaml.load() sin SafeLoader
    const pickleRegex = /\b(pickle\.loads?|yaml\.load)\s*\(/g;
    let pickleMatch;
    while ((pickleMatch = pickleRegex.exec(codigo)) !== null) {
        // En caso de yaml.load, verificar si tiene Loader=yaml.SafeLoader
        const snippetToEol = codigo.substring(pickleMatch.index, codigo.indexOf('\n', pickleMatch.index));
        if (pickleMatch[1] === 'yaml.load' && snippetToEol.includes('SafeLoader')) {
            continue;
        }

        const { line, snippet } = obtenerDetallesLinea(codigo, pickleMatch.index);
        securityAlerts.push({
            type: 'unsafe_deserialization',
            line,
            snippet,
            message: `Deserialización insegura detectada: '${pickleMatch[1]}()'.`,
            risk: `Permite inyección de objetos maliciosos que pueden ejecutar comandos en el sistema.`,
            recommendation: `Usa 'json.loads' para datos, o 'yaml.safe_load()' si usas YAML.`
        });
    }

    // SQL Injection Smells: Ejecución directa de queries con f-strings o %s
    const sqlRegex = /\b(execute|execute_query)\s*\(\s*[f]?(["']).*(SELECT|INSERT|UPDATE|DELETE|DROP).*\{.*\}.*\2/gi;
    let sqlMatch;
    while ((sqlMatch = sqlRegex.exec(codigo)) !== null) {
        const { line, snippet } = obtenerDetallesLinea(codigo, sqlMatch.index);
        securityAlerts.push({
            type: 'sql_injection',
            line,
            snippet,
            message: `Posible inyección SQL: Consulta construida de forma dinámica (interpolación de strings).`,
            risk: `Si las variables inyectadas provienen de un usuario, un atacante puede alterar la consulta SQL.`,
            recommendation: `Usa parámetros vinculados (parameterized queries) proporcionados por tu ORM o driver de BD.`
        });
    }

    // Django Debug = True
    const debugRegex = /^DEBUG\s*=\s*True/m;
    let debugMatch = debugRegex.exec(codigo);
    if (debugMatch) {
        const { line, snippet } = obtenerDetallesLinea(codigo, debugMatch.index);
        securityAlerts.push({
            type: 'config_exposure',
            line,
            snippet,
            message: `Modo DEBUG activado (DEBUG = True).`,
            risk: `Exponer DEBUG en producción revela trazas de la pila, variables locales y configuración a los usuarios, facilitando ataques dirigidos.`,
            recommendation: `Carga DEBUG desde una variable de entorno: DEBUG = os.getenv('DEBUG', 'False') == 'True'.`
        });
    }

    return securityAlerts;
}

module.exports = { auditarSeguridadPy };
