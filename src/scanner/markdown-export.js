function generarContenidoMarkdown(grafo) {
    let md = `# Plano de Arquitectura del Proyecto (Alta Densidad - Optimizado para IA)\n\n`;
    md += `Este archivo contiene la estructura jerárquica, relaciones de importación y auditorías de seguridad en un formato supercondensado de alta densidad. Está optimizado para minimizar el consumo de tokens y maximizar la precisión en asistentes de IA.\n\n`;
    
    const locales = grafo.nodes.filter(n => n.type === 'local');
    const externos = grafo.nodes.filter(n => n.type === 'external');
    const faltantes = grafo.nodes.filter(n => n.type === 'missing');
    const vulnerabilidadesCount = locales.filter(n => n.hasSecurity).reduce((acc, n) => acc + (n.securityAlerts ? n.securityAlerts.length : 0), 0);
    
    md += `## 📊 Resumen Ejecutivo\n`;
    md += `- **Módulos Locales:** ${locales.length} | **Externos:** ${externos.length} | **Faltantes:** ${faltantes.length}\n`;
    md += `- **Ciclos Circulares:** ${grafo.cycles ? grafo.cycles.length : 0} | **Riesgos de Seguridad:** ${vulnerabilidadesCount}\n\n`;

    const stack = grafo.techStack || {};
    md += `## 🛠️ Stack Tecnológico & Integraciones Clave\n`;
    
    if (grafo.tipoEntorno.startsWith('backend')) {
        md += `- **Framework / Core:** ${stack.framework || (grafo.tipoEntorno === 'backend' ? 'Python (General)' : 'Node.js (General)')}\n`;
        md += `- **ORM / Base de Datos:** ${stack.orm || 'No detectado / Nativo'}\n`;
        md += `- **Control de Migraciones:** ${stack.migrations || 'Ninguno detectado'}\n`;
        if (stack.cache) md += `- **Sistema de Caché:** ${stack.cache}\n`;
        if (stack.backgroundTasks) md += `- **Colas de Tareas / Broker:** ${stack.backgroundTasks}\n`;
        md += `- **Validación / Schemas:** ${stack.validation || 'Ninguno'}\n`;
    } else {
        md += `- **Framework / Core:** ${stack.framework || 'React (Cliente)'}\n`;
        md += `- **Gestión de Estado Local:** ${stack.stateLocal || 'React Context / Local State'}\n`;
        md += `- **Gestión de Estado Servidor:** ${stack.stateServer || 'Fetch API / Nativo'}\n`;
        md += `- **Tipado & Validación:** ${stack.validation || 'Ninguno'}\n`;
        md += `- **Estilos & CSS:** ${stack.styling || 'CSS nativo'}\n`;
        if (stack.forms) md += `- **Formularios:** ${stack.forms}\n`;
        if (stack.uiComponents) md += `- **Componentes UI:** ${stack.uiComponents}\n`;
    }
    md += `\n`;

    md += `## 🗂️ Capas de Arquitectura Limpia\n`;
    let capas = [];
    let nombresCapas = {};
    
    if (grafo.tipoEntorno.startsWith('backend')) {
        capas = ['models', 'services', 'routers', 'infra', 'asset', 'external', 'missing'];
        nombresCapas = {
            models: 'Modelos (Entidades)',
            services: 'Servicios (Lógica de Negocio)',
            routers: 'Rutas / Controladores',
            infra: 'Infraestructura / Utilidades',
            asset: 'Recursos / Configuración',
            external: 'Módulos Externos',
            missing: 'Importaciones Faltantes'
        };
    } else {
        capas = ['domain', 'data', 'hooks', 'logic', 'presentation', 'asset', 'external', 'missing'];
        nombresCapas = {
            domain: 'Dominio (Tipos/Modelos)',
            data: 'Infraestructura (Datos/API/Utils)',
            hooks: 'Aplicación (Hooks)',
            logic: 'Negocio (Estado/Contexto)',
            presentation: 'Presentación (UI/Vistas)',
            asset: 'Recursos (Assets/Styles/JSON)',
            external: 'Módulos Externos',
            missing: 'Importaciones Faltantes'
        };
    }

    capas.forEach(capa => {
        const nodosCapa = grafo.nodes.filter(n => n.layer === capa);
        if (nodosCapa.length > 0) {
            md += `### 📁 ${nombresCapas[capa] || capa} (${nodosCapa.length})\n`;
            nodosCapa.forEach(n => {
                const info = [];
                if (n.lines) info.push(`${n.lines} LOC`);
                if (n.exportName) info.push(`export ${n.exportName}`);
                if (n.hasSecurity) info.push(`⚠️ ALERTA SEGURIDAD`);
                const infoStr = info.length > 0 ? ` [${info.join(' | ')}]` : '';
                md += `- **[\`${n.name}\`](${n.id})**${infoStr}\n`;
            });
            md += `\n`;
        }
    });

    md += `## 🔌 Grafo de Importaciones (Dependencias)\n`;
    locales.forEach(n => {
        const importaciones = grafo.links.filter(l => (l.source?.id || l.source) === n.id);
        if (importaciones.length > 0) {
            const listTargetStrings = importaciones.map(l => {
                const targetId = l.target?.id || l.target;
                const targetNode = grafo.nodes.find(node => node.id === targetId);
                const targetName = targetNode ? targetNode.name : targetId;
                let suffix = '';
                if (l.violation && l.inCycle) suffix = ' ⚠️🔄';
                else if (l.violation) suffix = ' ⚠️[INFRACCIÓN]';
                else if (l.inCycle) suffix = ' 🔄[CICLO]';
                return `[\`${targetName}\`](${targetId})${suffix}`;
            });
            md += `- **[\`${n.name}\`](${n.id})** ➔ ${listTargetStrings.join(', ')}\n`;
        }
    });
    md += `\n`;

    const nodosVulnerables = grafo.nodes.filter(n => n.hasSecurity);
    if (nodosVulnerables.length > 0 || (grafo.npmVulnerabilities && grafo.npmVulnerabilities.length > 0)) {
        md += `## 🛡️ Diagnóstico de Seguridad & Riesgos\n`;

        nodosVulnerables.forEach(n => {
            if (n.securityAlerts) {
                n.securityAlerts.forEach(alert => {
                    const lineStr = alert.line ? `:L${alert.line}` : '';
                    const codeStr = alert.snippet ? ` | \`${alert.snippet}\`` : '';
                    md += `- ⚠️ **[\`${n.name}\`](${n.id})${lineStr}** | ${alert.message}${codeStr}\n`;
                    if (alert.risk) md += `  - *Riesgo:* ${alert.risk}\n`;
                    if (alert.recommendation) md += `  - *Solución:* ${alert.recommendation}\n`;
                });
            }
        });
        
        const npmVulnerabilities = grafo.npmVulnerabilities || [];
        npmVulnerabilities.forEach(v => {
            md += `- 📦 **Módulo npm: \`${v.package}\` (${v.declared})** | ${v.risk}\n`;
        });
        md += `\n`;
    }

    if (grafo.cycles && grafo.cycles.length > 0) {
        md += `## 🔄 Dependencias Circulares (Ciclos)\n`;
        grafo.cycles.forEach((ciclo, idx) => {
            md += `- **Ciclo #${idx + 1}:** \`${ciclo.join(' ➔ ')}\`\n`;
        });
    }

    return md;
}

module.exports = { generarContenidoMarkdown };
