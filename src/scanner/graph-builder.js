const path = require('path');

function procesarGrafo(grafo) {
    // 1. POST-PROCESAMIENTO PARA AGREGAR NODOS EXTERNOS/FALTANTES/ASSETS
    const nodosExistentes = new Set(grafo.nodes.map(n => n.id));

    grafo.links.forEach(link => {
        if (!nodosExistentes.has(link.target)) {
            const ext = path.extname(link.target).toLowerCase();
            // Determinamos si es externo basado en su ruta
            const esExterno = !link.target.startsWith('src/') && !link.target.startsWith('./src/') && !link.target.startsWith('.') && !link.target.startsWith('/');
            
            let tipo = 'missing';
            if (esExterno) {
                tipo = 'external';
            } else if (['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.json', '.html'].includes(ext)) {
                tipo = 'asset';
            }

            // Verificar si es una dependencia externa vulnerable
            let hasSecurity = false;
            let securityAlerts = null;
            if (tipo === 'external' && grafo.npmVulnerabilities) {
                const foundVulnerability = grafo.npmVulnerabilities.find(v => v.package === link.target);
                if (foundVulnerability) {
                    hasSecurity = true;
                    securityAlerts = [{
                        type: 'npm_vulnerability',
                        message: `Vulnerabilidad detectada en dependencia npm: '${foundVulnerability.package}' (${foundVulnerability.declared})`,
                        risk: foundVulnerability.risk,
                        recommendation: `Actualiza la dependencia '${foundVulnerability.package}' en tu 'package.json' a la versión recomendada.`
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

    // 2. AUDITORÍA DE ENLACES PARA ARQUITECTURA LIMPIA
    const mapaNodos = {};
    grafo.nodes.forEach(n => {
        mapaNodos[n.id] = n;
    });

    // Estas jerarquías aplican genéricamente a las capas definidas
    const jerarquiaCapas = {
        'domain': 1,
        'data': 2,
        'hooks': 3,
        'logic': 4,
        'presentation': 5,
        'models': 1,
        'services': 2,
        'routers': 3,
        'infra': 4
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

    // 3. DETECCIÓN DE DEPENDENCIAS CIRCULARES (DFS)
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

module.exports = { procesarGrafo };
