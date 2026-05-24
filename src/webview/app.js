        let selectedNode = null;

        // Calcular el in-degree (número de enlaces/importaciones que apuntan a cada nodo)
        const inDegree = {};
        data.nodes.forEach(n => inDegree[n.id] = 0);
        data.links.forEach(l => {
            const targetId = l.target?.id || l.target;
            if (inDegree[targetId] !== undefined) {
                inDegree[targetId]++;
            }
        });

        function esCodigoMuerto(n) {
            if (n.type !== 'local') return false;
            if ((inDegree[n.id] || 0) > 0) return false;
            
            const nombre = n.name.toLowerCase();
            const pathLower = n.id.toLowerCase();
            
            // 1. Filtrar puntos de entrada comunes de React/Vite
            const esPuntoEntradaReact = nombre === 'main.tsx' || nombre === 'main.ts' || nombre === 'main.jsx' || nombre === 'main.js' ||
                                        nombre === 'index.tsx' || nombre === 'index.ts' || nombre === 'index.jsx' || nombre === 'index.js' ||
                                        nombre === 'app.tsx' || nombre === 'app.ts' || nombre === 'app.jsx' || nombre === 'app.js';
            if (esPuntoEntradaReact) return false;

            // 2. Filtrar archivos especiales de Next.js (App Router)
            const esSpecialNextFile = nombre === 'layout.tsx' || nombre === 'layout.ts' || nombre === 'layout.jsx' || nombre === 'layout.js' ||
                                      nombre === 'page.tsx' || nombre === 'page.ts' || nombre === 'page.jsx' || nombre === 'page.js' ||
                                      nombre === 'loading.tsx' || nombre === 'loading.ts' || nombre === 'loading.jsx' || nombre === 'loading.js' ||
                                      nombre === 'error.tsx' || nombre === 'error.ts' || nombre === 'error.jsx' || nombre === 'error.js' ||
                                      nombre === 'template.tsx' || nombre === 'template.ts' || nombre === 'template.jsx' || nombre === 'template.js' ||
                                      nombre === 'not-found.tsx' || nombre === 'not-found.ts' || nombre === 'not-found.jsx' || nombre === 'not-found.js' ||
                                      nombre === 'route.ts' || nombre === 'route.js' ||
                                      nombre === 'middleware.ts' || nombre === 'middleware.js' ||
                                      nombre === 'instrumentation.ts' || nombre === 'instrumentation.js';
            if (esSpecialNextFile) return false;
            
            // 3. Filtrar cualquier archivo que esté dentro de la carpeta 'pages' (Next.js Pages Router)
            if (pathLower.includes('/pages/') || pathLower.startsWith('pages/')) return false;

            return true;
        }

        function mostrarReporteGeneralCodigoMuerto() {
            d3.select("#inspector").style("display", "flex");
            d3.select("#inspector-node-details").style("display", "none");
            
            const reportContainer = d3.select("#inspector-general-report");
            reportContainer.style("display", "block").html("");
            
            // Buscar todos los nodos locales que son código muerto
            const nodosMuertos = activeNodes.filter(esCodigoMuerto);
            
            reportContainer.append("div")
                .attr("class", "deadcode-alert-title")
                .style("font-size", "12px")
                .style("margin-bottom", "6px")
                .text("⚠️ Limpieza de Código Muerto");
                
            reportContainer.append("div")
                .style("font-size", "11px")
                .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                .style("margin-bottom", "10px")
                .text("Se detectaron " + nodosMuertos.length + " archivos locales huérfanos (sin importaciones entrantes).");
                
            if (nodosMuertos.length > 0) {
                const listDiv = reportContainer.append("div")
                    .style("max-height", "220px")
                    .style("overflow-y", "auto")
                    .style("display", "flex")
                    .style("flex-direction", "column")
                    .style("gap", "6px");
                    
                nodosMuertos.forEach(n => {
                    const item = listDiv.append("div")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("padding", "6px")
                        .style("background", "rgba(255, 255, 255, 0.03)")
                        .style("border-radius", "4px")
                        .style("cursor", "pointer")
                        .style("transition", "background 0.2s")
                        .on("mouseover", function() { d3.select(this).style("background", "rgba(255, 255, 255, 0.08)"); })
                        .on("mouseout", function() { d3.select(this).style("background", "rgba(255, 255, 255, 0.03)"); })
                        .on("click", (e) => {
                            e.stopPropagation();
                            handleNodeClick(e, n);
                        });
                        
                    item.append("span")
                        .style("font-weight", "600")
                        .style("color", "#ffb703")
                        .style("font-size", "11px")
                        .text(n.name);
                        
                    item.append("span")
                        .style("font-size", "9px")
                        .style("color", "var(--vscode-descriptionForeground, #888)")
                        .style("word-break", "break-all")
                        .text(n.id);
                });
            } else {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "#2ec4b6")
                    .style("font-weight", "600")
                    .text("🎉 ¡Excelente! No se detectó código muerto.");
            }
        }

        function calcularMetricasGod(n) {
            if (n.type !== 'local') return { coupling: 0, complexity: 0, score: 0, esGod: false };
            
            // Grado de salida (out-degree): cuántos archivos importa
            const outDegree = data.links.filter(l => (l.source?.id || l.source) === n.id).length;
            // Grado de entrada (in-degree): cuántos archivos lo importan
            const inDegreeVal = inDegree[n.id] || 0;
            
            const coupling = inDegreeVal + outDegree;
            const lines = n.lines || 0;
            const score = coupling * (lines / 100);
            
            return {
                coupling,
                complexity: lines,
                score: parseFloat(score.toFixed(1)),
                esGod: score >= 50
            };
        }

        function mostrarReporteGeneralGodFiles() {
            d3.select("#inspector").style("display", "flex");
            d3.select("#inspector-node-details").style("display", "none");
            
            const reportContainer = d3.select("#inspector-general-report");
            reportContainer.style("display", "block").html("");
            
            // Buscar y calcular métricas para todos los nodos locales, ordenados por score desc
            const nodosConMetricas = activeNodes
                .filter(n => n.type === 'local')
                .map(n => ({ node: n, stats: calcularMetricasGod(n) }))
                .sort((a, b) => b.stats.score - a.stats.score);
            
            const godFiles = nodosConMetricas.filter(item => item.stats.esGod);
            
            reportContainer.append("div")
                .attr("class", "godfile-alert-title")
                .style("font-size", "12px")
                .style("margin-bottom", "6px")
                .text("⚠️ Auditoría de God Files");
                
            reportContainer.append("div")
                .style("font-size", "11px")
                .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                .style("margin-bottom", "10px")
                .text("Se detectaron " + godFiles.length + " archivos con God Score >= 50 (Complejidad y Acoplamiento excesivos).");
                
            if (nodosConMetricas.length > 0) {
                const listDiv = reportContainer.append("div")
                    .style("max-height", "240px")
                    .style("overflow-y", "auto")
                    .style("display", "flex")
                    .style("flex-direction", "column")
                    .style("gap", "6px");
                    
                nodosConMetricas.forEach(item => {
                    const n = item.node;
                    const stats = item.stats;
                    
                    const itemDiv = listDiv.append("div")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("padding", "6px")
                        .style("background", stats.esGod ? "rgba(208, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.03)")
                        .style("border", stats.esGod ? "1px solid rgba(208, 0, 0, 0.4)" : "1px solid transparent")
                        .style("border-radius", "4px")
                        .style("cursor", "pointer")
                        .style("transition", "background 0.2s")
                        .on("mouseover", function() { d3.select(this).style("background", stats.esGod ? "rgba(208, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.08)"); })
                        .on("mouseout", function() { d3.select(this).style("background", stats.esGod ? "rgba(208, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.03)"); })
                        .on("click", (e) => {
                            e.stopPropagation();
                            handleNodeClick(e, n);
                        });
                        
                    const header = itemDiv.append("div")
                        .style("display", "flex")
                        .style("justify-content", "space-between")
                        .style("align-items", "center");
                        
                    header.append("span")
                        .style("font-weight", "600")
                        .style("color", stats.esGod ? "#ff4d4d" : "#ffb703")
                        .style("font-size", "11px")
                        .text(n.name);
                        
                    header.append("span")
                        .style("font-weight", "700")
                        .style("font-size", "10px")
                        .style("color", stats.esGod ? "#ff4d4d" : "var(--vscode-descriptionForeground, #888)")
                        .text("Score: " + stats.score);
                        
                    itemDiv.append("span")
                        .style("font-size", "9px")
                        .style("color", "var(--vscode-descriptionForeground, #888)")
                        .style("margin-top", "2px")
                        .text("Líneas: " + stats.complexity + " | Conexiones: " + stats.coupling);
                });
            }
        }

        function mostrarReporteGeneralSeguridad() {
            d3.select("#inspector").style("display", "flex");
            d3.select("#inspector-node-details").style("display", "none");
            
            const reportContainer = d3.select("#inspector-general-report");
            reportContainer.style("display", "block").html("");
            
            const nodosVulnerables = activeNodes.filter(n => n.hasSecurity);
            
            reportContainer.append("div")
                .attr("class", "security-alert-title")
                .style("font-size", "12px")
                .style("margin-bottom", "6px")
                .text("🛡️ Auditoría de Seguridad");
                
            reportContainer.append("div")
                .style("font-size", "11px")
                .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                .style("margin-bottom", "10px")
                .text("Se detectaron " + nodosVulnerables.length + " archivos locales con riesgos de seguridad.");
                
            if (nodosVulnerables.length > 0) {
                const listDiv = reportContainer.append("div")
                    .style("max-height", "240px")
                    .style("overflow-y", "auto")
                    .style("display", "flex")
                    .style("flex-direction", "column")
                    .style("gap", "6px");
                    
                nodosVulnerables.forEach(n => {
                    const itemDiv = listDiv.append("div")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("padding", "6px")
                        .style("background", "rgba(255, 60, 56, 0.08)")
                        .style("border", "1px solid rgba(255, 60, 56, 0.3)")
                        .style("border-radius", "4px")
                        .style("cursor", "pointer")
                        .style("transition", "background 0.2s")
                        .on("mouseover", function() { d3.select(this).style("background", "rgba(255, 60, 56, 0.15)"); })
                        .on("mouseout", function() { d3.select(this).style("background", "rgba(255, 60, 56, 0.08)"); })
                        .on("click", (e) => {
                            e.stopPropagation();
                            handleNodeClick(e, n);
                        });
                        
                    const header = itemDiv.append("div")
                        .style("display", "flex")
                        .style("justify-content", "space-between")
                        .style("align-items", "center");
                        
                    header.append("span")
                        .style("font-weight", "600")
                        .style("color", "#ff4d4d")
                        .style("font-size", "11px")
                        .text(n.name);
                        
                    header.append("span")
                        .style("font-weight", "700")
                        .style("font-size", "10px")
                        .style("color", "#ff4d4d")
                        .text((n.securityAlerts ? n.securityAlerts.length : 0) + " alerta(s)");
                        
                    itemDiv.append("span")
                        .style("font-size", "9px")
                        .style("color", "var(--vscode-descriptionForeground, #888)")
                        .style("margin-top", "2px")
                        .style("word-break", "break-all")
                        .text(n.id);
                });
            } else {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "#2ec4b6")
                    .style("font-weight", "600")
                    .text("🎉 ¡Excelente! No se detectaron vulnerabilidades críticas de seguridad.");
            }

            // AGREGAR MAPA DE SUPERFICIE DE ATAQUE (Next.js Routes)
            reportContainer.append("div")
                .style("margin-top", "20px")
                .style("margin-bottom", "6px")
                .style("font-weight", "700")
                .style("color", "#ff9f1c")
                .style("font-size", "12px")
                .text("🌐 Superficie de Ataque (Next.js)");

            const routeNodes = activeNodes.filter(n => n.routeInfo && n.routeInfo.isRoute);

            if (routeNodes.length > 0) {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                    .style("margin-bottom", "8px")
                    .text("Se detectaron " + routeNodes.length + " rutas y endpoints locales.");

                const routeList = reportContainer.append("div")
                    .style("max-height", "220px")
                    .style("overflow-y", "auto")
                    .style("display", "flex")
                    .style("flex-direction", "column")
                    .style("gap", "6px");

                routeNodes.forEach(n => {
                    const info = n.routeInfo;
                    let bgColor = "rgba(255, 159, 28, 0.08)";
                    let borderColor = "rgba(255, 159, 28, 0.3)";
                    let statusLabel = "⚠️ Verificar en Middleware";
                    let labelColor = "#ff9f1c";
                    
                    if (info.status === 'protected') {
                        bgColor = "rgba(46, 196, 182, 0.08)";
                        borderColor = "rgba(46, 196, 182, 0.3)";
                        statusLabel = "🛡️ Protegido Directamente";
                        labelColor = "#2ec4b6";
                    } else if (info.status === 'public') {
                        bgColor = "rgba(58, 134, 248, 0.08)";
                        borderColor = "rgba(58, 134, 248, 0.3)";
                        statusLabel = "🌐 Público Conocido";
                        labelColor = "#3a86f8";
                    }

                    const routeItem = routeList.append("div")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("padding", "6px")
                        .style("background", bgColor)
                        .style("border", "1px solid " + borderColor)
                        .style("border-radius", "4px")
                        .style("cursor", "pointer")
                        .style("transition", "background 0.2s")
                        .on("mouseover", function() { d3.select(this).style("background", bgColor.replace("0.08", "0.15")); })
                        .on("mouseout", function() { d3.select(this).style("background", bgColor); })
                        .on("click", (e) => {
                            e.stopPropagation();
                            handleNodeClick(e, n);
                        });

                    const itemHeader = routeItem.append("div")
                        .style("display", "flex")
                        .style("justify-content", "space-between")
                        .style("align-items", "center");

                    itemHeader.append("span")
                        .style("font-weight", "600")
                        .style("color", "#fff")
                        .style("font-size", "11px")
                        .text(n.name + " (" + (info.routeType === 'page' ? 'Página' : 'API Route') + ")");

                    itemHeader.append("span")
                        .style("font-weight", "700")
                        .style("font-size", "9px")
                        .style("color", labelColor)
                        .text(statusLabel);

                    routeItem.append("span")
                        .style("font-size", "9px")
                        .style("color", "var(--vscode-descriptionForeground, #888)")
                        .style("margin-top", "2px")
                        .style("word-break", "break-all")
                        .text(n.id);
                });
            } else {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "var(--vscode-descriptionForeground, #888)")
                    .text("No se encontraron páginas ni endpoints de API en este proyecto.");
            }

            // AGREGAR AUDITORÍA DE DEPENDENCIAS (package.json)
            reportContainer.append("div")
                .style("margin-top", "20px")
                .style("margin-bottom", "6px")
                .style("font-weight", "700")
                .style("color", "#ff3c38")
                .style("font-size", "12px")
                .text("📦 Auditoría de Dependencias (package.json)");

            const vulnerabilities = data.npmVulnerabilities || [];

            if (vulnerabilities.length > 0) {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                    .style("margin-bottom", "8px")
                    .text("Se detectaron " + vulnerabilities.length + " dependencias críticas con riesgos:");

                const depList = reportContainer.append("div")
                    .style("max-height", "200px")
                    .style("overflow-y", "auto")
                    .style("display", "flex")
                    .style("flex-direction", "column")
                    .style("gap", "6px");

                vulnerabilities.forEach(v => {
                    const depItem = depList.append("div")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("padding", "6px")
                        .style("background", "rgba(255, 60, 56, 0.08)")
                        .style("border", "1px solid rgba(255, 60, 56, 0.3)")
                        .style("border-radius", "4px")
                        .style("cursor", "pointer")
                        .style("transition", "background 0.2s")
                        .on("mouseover", function() { d3.select(this).style("background", "rgba(255, 60, 56, 0.15)"); })
                        .on("mouseout", function() { d3.select(this).style("background", "rgba(255, 60, 56, 0.08)"); })
                        .on("click", (e) => {
                            e.stopPropagation();
                            const targetNode = data.nodes.find(n => n.id === v.package);
                            if (targetNode) {
                                handleNodeClick(e, targetNode);
                            }
                        });

                    const itemHeader = depItem.append("div")
                        .style("display", "flex")
                        .style("justify-content", "space-between")
                        .style("align-items", "center");

                    itemHeader.append("span")
                        .style("font-weight", "600")
                        .style("color", "#ff4d4d")
                        .style("font-size", "11px")
                        .text(v.package);

                    itemHeader.append("span")
                        .style("font-weight", "700")
                        .style("font-size", "10px")
                        .style("color", "#ff4d4d")
                        .text(v.declared);

                    depItem.append("span")
                        .style("font-size", "10px")
                        .style("color", "var(--vscode-sideBar-foreground, #ccc)")
                        .style("margin-top", "2px")
                        .text(v.risk);
                });
            } else {
                reportContainer.append("div")
                    .style("font-size", "11px")
                    .style("color", "#2ec4b6")
                    .style("font-weight", "600")
                    .text("🎉 ¡Excelente! Todas las dependencias en package.json están seguras.");
            }
        }

        // Configuración de visualización de Capas
        const capaEspanol = {
            'domain': 'Dominio (Tipos/Modelos)',
            'data': 'Infraestructura (Datos/API/Utils)',
            'hooks': 'Aplicación (Custom Hooks)',
            'logic': 'Negocio (Estado/Contexto)',
            'presentation': 'Presentación (UI/Componentes)',
            'external': 'Módulo Externo (npm)',
            'missing': 'Importación Faltante',
            'asset': 'Recurso / Asset'
        };

        const capaColores = {
            'domain': '#3a86f8',
            'data': '#2ec4b6',
            'hooks': '#ffb703',
            'logic': '#ff006e',
            'presentation': '#8338ec',
            'external': '#5c677d',
            'missing': '#e63946',
            'asset': '#f77f00'
        };

        const layerColumns = {
            'external': 0.08,
            'domain': 0.22,
            'data': 0.36,
            'hooks': 0.50,
            'logic': 0.64,
            'presentation': 0.78,
            'asset': 0.92,
            'missing': 0.92
        };

        const columnLabels = [
            { name: 'Externo', x: 0.08 },
            { name: 'Dominio', x: 0.22 },
            { name: 'Infraestructura', x: 0.36 },
            { name: 'Aplicación', x: 0.50 },
            { name: 'Negocio', x: 0.64 },
            { name: 'Presentación', x: 0.78 },
            { name: 'Otros / Assets', x: 0.92 }
        ];

        // Estado de Radio de Impacto
        let activeBlastSource = null;
        let impactedNodesSet = new Set();

        // Algoritmo BFS para hallar todos los nodos dependientes (radio de impacto de cambios)
        function calcularRadioImpacto(nodeId, links) {
            const impactados = new Set();
            const cola = [nodeId];
            
            const mapaImportadores = {};
            links.forEach(l => {
                const sId = l.source?.id || l.source;
                const tId = l.target?.id || l.target;
                if (!mapaImportadores[tId]) {
                    mapaImportadores[tId] = [];
                }
                mapaImportadores[tId].push(sId);
            });

            while (cola.length > 0) {
                const actual = cola.shift();
                const importadores = mapaImportadores[actual] || [];
                for (const imp of importadores) {
                    if (!impactados.has(imp) && imp !== nodeId) {
                        impactados.add(imp);
                        cola.push(imp);
                    }
                }
            }

            return impactados;
        }

        function iniciarBlastRadius(nodeId) {
            activeBlastSource = nodeId;
            impactedNodesSet = calcularRadioImpacto(nodeId, data.links);
            render();
        }

        function limpiarBlastRadius() {
            activeBlastSource = null;
            impactedNodesSet.clear();
            render();
        }

        // Función para calcular el tamaño dinámico de un nodo basado en su importancia
        function obtenerRadioNodo(d) {
            if (d.type === 'external') return 6;
            if (d.type === 'missing') return 7;
            
            // Radio base de 9px, crece según el número de importaciones entrantes (máximo 25px)
            const count = inDegree[d.id] || 0;
            return Math.min(9 + count * 2.5, 25);
        }

        let width = window.innerWidth;
        let height = window.innerHeight;

        const svg = d3.select("#grafo")
            .attr("width", width)
            .attr("height", height);

        const g = svg.append("g");

        svg.call(d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(140))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(d => obtenerRadioNodo(d) + 15));

        let link = g.append("g").attr("class", "enlaces").selectAll("line");
        let node = g.append("g").attr("class", "nodos").selectAll("circle");
        let label = g.append("g").attr("class", "etiquetas").selectAll("text");

        let activeNodes = [...data.nodes];
        let activeLinks = [...data.links];

        function actualizarEncabezadosColumnas() {
            const agrupar = d3.select("#toggle-cluster").property("checked");
            const container = d3.select("#column-headers");
            if (agrupar) {
                container.style("display", "block").html("");
                columnLabels.forEach(col => {
                    container.append("div")
                        .attr("class", "column-header")
                        .style("left", (col.x * 100) + "%")
                        .text(col.name);
                });
            } else {
                container.style("display", "none");
            }
        }

        function render() {
            const showExternal = d3.select("#toggle-external").property("checked");
            const showMissing = d3.select("#toggle-missing").property("checked");
            const searchQuery = d3.select("#search-input").property("value").toLowerCase().trim();
            const agrupar = d3.select("#toggle-cluster").property("checked");
            const highlightCycles = d3.select("#toggle-cycles").property("checked");
            const highlightDead = d3.select("#toggle-deadcode").property("checked");
            const highlightGod = d3.select("#toggle-godfiles").property("checked");
            const highlightSecurity = d3.select("#toggle-security").property("checked");

            activeNodes = data.nodes.filter(n => {
                if (n.type === 'external' && !showExternal) return false;
                if (n.type === 'missing' && !showMissing) return false;
                return true;
            });

            const activeNodeIds = new Set(activeNodes.map(n => n.id));

            activeLinks = data.links.filter(l => {
                const sourceId = l.source?.id || l.source;
                const targetId = l.target?.id || l.target;
                return activeNodeIds.has(sourceId) && activeNodeIds.has(targetId);
            });

            // Sincronizar enlaces
            const linkSelection = link.data(activeLinks, d => (d.source?.id || d.source) + "-" + (d.target?.id || d.target));
            linkSelection.exit().remove();
            const linkEnter = linkSelection.enter().append("line");
            link = linkEnter.merge(linkSelection)
                .attr("class", d => "enlace" + (d.violation ? " violation" : "") + (d.inCycle ? " cycle" : ""));

            // Sincronizar nodos
            const nodeSelection = node.data(activeNodes, d => d.id);
            nodeSelection.exit().remove();
            const nodeEnter = nodeSelection.enter().append("circle")
                .attr("r", obtenerRadioNodo)
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended))
                .on("mouseover", handleMouseOver)
                .on("mouseout", handleMouseOut)
                .on("click", handleNodeClick)
                .on("dblclick", handleDoubleClick);
            node = nodeEnter.merge(nodeSelection)
                .attr("class", d => "nodo " + (d.layer || d.type || "local"));

            const labelSelection = label.data(activeNodes, d => d.id);
            labelSelection.exit().remove();
            const labelEnter = labelSelection.enter().append("text")
                .attr("class", "etiqueta")
                .attr("dy", d => - (obtenerRadioNodo(d) + 5))
                .text(d => {
                    if (d.exportName) {
                        const lowName = d.name.toLowerCase();
                        if (lowName.startsWith('page.') || lowName.startsWith('layout.') || lowName.startsWith('route.') || lowName.startsWith('index.')) {
                            return d.name + ' (' + d.exportName + ')';
                        }
                    }
                    return d.name;
                });
            label = labelEnter.merge(labelSelection);

            if (activeBlastSource) {
                node.style("opacity", n => n.id === activeBlastSource || impactedNodesSet.has(n.id) ? 1 : 0.08)
                    .classed("impact-source", n => n.id === activeBlastSource)
                    .classed("impacted", n => impactedNodesSet.has(n.id))
                    .classed("cycle-highlight", false)
                    .classed("dead-highlight", false)
                    .classed("god-highlight", false)
                    .classed("security-highlight", false);

                label.style("opacity", n => n.id === activeBlastSource || impactedNodesSet.has(n.id) ? 1 : 0.08);

                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    const isImpactLink = (tId === activeBlastSource || impactedNodesSet.has(tId)) && impactedNodesSet.has(sId);
                    return isImpactLink ? 0.95 : 0.02;
                }).classed("impact-path", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return (tId === activeBlastSource || impactedNodesSet.has(tId)) && impactedNodesSet.has(sId);
                }).classed("cycle", false);
            } else if (highlightDead) {
                node.classed("impact-source", false).classed("impacted", false)
                    .classed("cycle-highlight", false)
                    .classed("dead-highlight", n => esCodigoMuerto(n))
                    .classed("god-highlight", false)
                    .classed("security-highlight", false)
                    .classed("exposed-route", false);
                link.classed("impact-path", false).classed("cycle", false);

                node.style("opacity", n => esCodigoMuerto(n) ? 1.0 : 0.1);
                label.style("opacity", n => esCodigoMuerto(n) ? 1.0 : 0.1);
                link.style("opacity", 0.02);
            } else if (highlightGod) {
                node.classed("impact-source", false).classed("impacted", false)
                    .classed("cycle-highlight", false)
                    .classed("dead-highlight", false)
                    .classed("god-highlight", n => calcularMetricasGod(n).esGod)
                    .classed("security-highlight", false)
                    .classed("exposed-route", false);
                link.classed("impact-path", false).classed("cycle", false);

                node.style("opacity", n => calcularMetricasGod(n).esGod ? 1.0 : 0.15);
                label.style("opacity", n => calcularMetricasGod(n).esGod ? 1.0 : 0.15);
                link.style("opacity", 0.05);
            } else if (highlightSecurity) {
                node.classed("impact-source", false).classed("impacted", false)
                    .classed("cycle-highlight", false)
                    .classed("dead-highlight", false)
                    .classed("god-highlight", false)
                    .classed("security-highlight", n => n.hasSecurity && (!n.routeInfo || n.routeInfo.status !== 'exposed'))
                    .classed("exposed-route", n => n.routeInfo && n.routeInfo.status === 'exposed');
                link.classed("impact-path", false).classed("cycle", false);

                node.style("opacity", n => n.hasSecurity ? 1.0 : 0.1);
                label.style("opacity", n => n.hasSecurity ? 1.0 : 0.1);
                link.style("opacity", 0.02);
            } else {
                node.classed("impact-source", false).classed("impacted", false).classed("dead-highlight", false).classed("god-highlight", false).classed("security-highlight", false).classed("exposed-route", false);
                link.classed("impact-path", false);

                if (highlightCycles) {
                    node.style("opacity", n => n.inCycle ? 1 : 0.1)
                        .classed("cycle-highlight", n => n.inCycle);
                    label.style("opacity", n => n.inCycle ? 1 : 0.1);
                    link.style("opacity", l => l.inCycle ? 0.95 : 0.05)
                        .classed("cycle", l => l.inCycle);
                } else {
                    node.classed("cycle-highlight", false);
                    link.classed("cycle", false);

                    if (searchQuery) {
                        node.style("opacity", n => n.name.toLowerCase().includes(searchQuery) ? 1 : 0.15);
                        label.style("opacity", n => n.name.toLowerCase().includes(searchQuery) ? 1 : 0.15)
                             .style("fill", n => n.name.toLowerCase().includes(searchQuery) ? "#fff" : "#c9ada7");
                        link.style("opacity", 0.05);
                    } else {
                        node.style("opacity", 1);
                        label.style("opacity", 1).style("fill", "#c9ada7");
                        link.style("opacity", d => d.violation ? 0.85 : 0.4);
                    }
                }
            }

            // Si hay un nodo seleccionado, mantener su estado tras refrescos de filtros
            if (selectedNode) {
                const nodeStillActive = activeNodeIds.has(selectedNode.id);
                if (nodeStillActive) {
                    highlightSelectedNode(selectedNode);
                } else {
                    deselectNode();
                }
            } else {
                if (highlightDead) {
                    mostrarReporteGeneralCodigoMuerto();
                } else if (highlightGod) {
                    mostrarReporteGeneralGodFiles();
                } else if (highlightSecurity) {
                    mostrarReporteGeneralSeguridad();
                } else {
                    d3.select("#inspector").style("display", "none");
                }
            }

            // Aplicar o remover fuerzas de agrupamiento por columnas (Clustering)
            if (agrupar) {
                simulation.force("x", d3.forceX(d => width * (layerColumns[d.layer] || 0.78)).strength(0.8));
                simulation.force("y", d3.forceY(height / 2).strength(0.2));
                simulation.force("center", null);
            } else {
                simulation.force("x", null);
                simulation.force("y", null);
                simulation.force("center", d3.forceCenter(width / 2, height / 2));
            }

            actualizarEncabezadosColumnas();

            simulation.nodes(activeNodes);
            simulation.force("link").links(activeLinks);
            simulation.force("collision").radius(d => obtenerRadioNodo(d) + 15);
            simulation.alpha(0.5).restart();
        }

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        });

        d3.select("#toggle-external").on("change", render);
        d3.select("#toggle-missing").on("change", render);
        d3.select("#toggle-cluster").on("change", render);
        
        d3.select("#toggle-cycles").on("change", function() {
            if (this.checked) {
                d3.select("#toggle-deadcode").property("checked", false);
                d3.select("#toggle-godfiles").property("checked", false);
                d3.select("#toggle-security").property("checked", false);
            }
            deselectNode();
            render();
        });
        
        d3.select("#toggle-deadcode").on("change", function() {
            if (this.checked) {
                d3.select("#toggle-cycles").property("checked", false);
                d3.select("#toggle-godfiles").property("checked", false);
                d3.select("#toggle-security").property("checked", false);
            }
            deselectNode();
            render();
        });
        
        d3.select("#toggle-godfiles").on("change", function() {
            if (this.checked) {
                d3.select("#toggle-cycles").property("checked", false);
                d3.select("#toggle-deadcode").property("checked", false);
                d3.select("#toggle-security").property("checked", false);
            }
            deselectNode();
            render();
        });

        d3.select("#toggle-security").on("change", function() {
            if (this.checked) {
                d3.select("#toggle-cycles").property("checked", false);
                d3.select("#toggle-deadcode").property("checked", false);
                d3.select("#toggle-godfiles").property("checked", false);
            }
            deselectNode();
            render();
        });
        
        d3.select("#search-input").on("input", render);

        // Minimizar / Maximizar paneles flotantes
        d3.select("#toggle-legend-btn").on("click", function(event) {
            if (event) event.stopPropagation();
            const panel = d3.select("#legend");
            const isMinimized = panel.classed("minimized");
            panel.classed("minimized", !isMinimized);
            d3.select(this).attr("title", isMinimized ? "Minimizar panel" : "Maximizar panel");
        });

        d3.select("#toggle-controls-btn").on("click", function(event) {
            if (event) event.stopPropagation();
            const panel = d3.select("#controls");
            const isMinimized = panel.classed("minimized");
            panel.classed("minimized", !isMinimized);
            d3.select(this).attr("title", isMinimized ? "Minimizar panel" : "Maximizar panel");
        });

        // Exportar arquitectura en Markdown para la IA
        d3.select("#export-md-btn").on("click", function(event) {
            if (event) event.stopPropagation();
            vscode.postMessage({
                command: 'exportarMarkdown'
            });
        });

        d3.select("#charge-slider").on("input", function() {
            const val = +this.value;
            d3.select("#charge-val").text(val);
            simulation.force("charge").strength(val);
            simulation.alpha(0.3).restart();
        });

        d3.select("#distance-slider").on("input", function() {
            const val = +this.value;
            d3.select("#distance-val").text(val);
            simulation.force("link").distance(val);
            simulation.alpha(0.3).restart();
        });

        window.addEventListener("resize", () => {
            width = window.innerWidth;
            height = window.innerHeight;
            svg.attr("width", width).attr("height", height);
            render();
        });

        render();

        // Autoseleccionar y enfocar el nodo inicial si existe
        if (initialFocusedNodeId) {
            const targetNode = data.nodes.find(n => n.id === initialFocusedNodeId);
            if (targetNode) {
                selectedNode = targetNode;
                highlightSelectedNode(targetNode);
                
                // Centrar suavemente la cámara sobre el nodo enfocado al inicializar
                setTimeout(() => {
                    if (targetNode.x !== undefined && targetNode.y !== undefined) {
                        const zoomBehavior = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => {
                            g.attr("transform", event.transform);
                        });
                        svg.transition().duration(800).call(
                            zoomBehavior.transform,
                            d3.zoomIdentity.translate(width / 2 - targetNode.x, height / 2 - targetNode.y).scale(1.2)
                        );
                    }
                }, 100);
            }
        }

        function handleNodeClick(event, d) {
            event.stopPropagation();
            if (selectedNode === d) {
                deselectNode();
                return;
            }
            selectedNode = d;
            highlightSelectedNode(d);
        }

        function highlightSelectedNode(d) {
            const highlightDead = d3.select("#toggle-deadcode").property("checked");
            const highlightGod = d3.select("#toggle-godfiles").property("checked");
            const highlightCycles = d3.select("#toggle-cycles").property("checked");
            const highlightSecurity = d3.select("#toggle-security").property("checked");

            // Opacidades: resaltar este nodo y sus conexiones directas
            if (activeBlastSource) {
                node.style("opacity", n => {
                    const isBlastMember = n.id === activeBlastSource || impactedNodesSet.has(n.id);
                    if (!isBlastMember) return 0.08;
                    return n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.3;
                });
                label.style("opacity", n => {
                    const isBlastMember = n.id === activeBlastSource || impactedNodesSet.has(n.id);
                    if (!isBlastMember) return 0.08;
                    return n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.3;
                });
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    const isImpactLink = (tId === activeBlastSource || impactedNodesSet.has(tId)) && impactedNodesSet.has(sId);
                    if (!isImpactLink) return 0.02;
                    return sId === d.id || tId === d.id ? 0.95 : 0.25;
                });
            } else if (highlightDead) {
                node.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.1)
                    .classed("dead-highlight", n => esCodigoMuerto(n))
                    .classed("cycle-highlight", false)
                    .classed("impact-source", false)
                    .classed("impacted", false)
                    .classed("god-highlight", false)
                    .classed("security-highlight", false)
                    .classed("exposed-route", false);
                label.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.1);
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id ? 0.95 : 0.02;
                }).classed("highlighted", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id;
                });
            } else if (highlightGod) {
                node.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.15)
                    .classed("dead-highlight", false)
                    .classed("cycle-highlight", false)
                    .classed("impact-source", false)
                    .classed("impacted", false)
                    .classed("god-highlight", n => calcularMetricasGod(n).esGod)
                    .classed("security-highlight", false)
                    .classed("exposed-route", false);
                label.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.15);
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id ? 0.95 : 0.05;
                }).classed("highlighted", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id;
                });
            } else if (highlightSecurity) {
                node.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.1)
                    .classed("dead-highlight", false)
                    .classed("cycle-highlight", false)
                    .classed("impact-source", false)
                    .classed("impacted", false)
                    .classed("god-highlight", false)
                    .classed("security-highlight", n => n.hasSecurity && (!n.routeInfo || n.routeInfo.status !== 'exposed'))
                    .classed("exposed-route", n => n.routeInfo && n.routeInfo.status === 'exposed');
                label.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1.0 : 0.1);
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id ? 0.95 : 0.02;
                }).classed("highlighted", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id;
                });
            } else if (highlightCycles) {
                node.classed("dead-highlight", false).classed("god-highlight", false).classed("security-highlight", false).classed("exposed-route", false);
                node.style("opacity", n => (n.id === d.id || esConectado(d.id, n.id)) && n.inCycle ? 1 : 0.1);
                label.style("opacity", n => (n.id === d.id || esConectado(d.id, n.id)) && n.inCycle ? 1 : 0.1);
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return (sId === d.id || tId === d.id) && l.inCycle ? 0.95 : 0.05;
                });
            } else {
                node.classed("dead-highlight", false).classed("god-highlight", false).classed("security-highlight", false).classed("exposed-route", false);
                node.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1 : 0.15);
                label.style("opacity", n => n.id === d.id || esConectado(d.id, n.id) ? 1 : 0.15);
                
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id ? 1 : 0.05;
                }).classed("highlighted", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    return sId === d.id || tId === d.id;
                });
            }

            // Mostrar y rellenar inspector
            d3.select("#inspector").style("display", "flex");
            d3.select("#inspector-node-details").style("display", "block");
            d3.select("#inspector-general-report").style("display", "none");

            const displayName = d.exportName ? d.name + ' (' + d.exportName + ')' : d.name;
            d3.select("#ins-name").text(displayName);
            d3.select("#ins-path").text(d.id);

            // Mostrar capa en el inspector
            const colorCapa = capaColores[d.layer] || '#7b2cbf';
            let layerHtml = "Capa: <span style='color: " + colorCapa + "; font-weight: 600;'>" + (capaEspanol[d.layer] || d.layer || 'Local') + "</span>";
            if (d.exportName) {
                layerHtml += "<br/>Componente: <span style='color: #ffb703; font-weight: 600;'>" + d.exportName + "</span>";
            }
            d3.select("#ins-layer").html(layerHtml);

            // Mostrar tamaño (solo si es local y existe)
            if (d.type === 'local' && d.size !== undefined) {
                const sizeText = d.size > 1024 
                    ? (d.size / 1024).toFixed(1) + ' KB' 
                    : d.size + ' B';
                d3.select("#ins-size").text("Tamaño: " + sizeText).style("display", "block");
            } else {
                d3.select("#ins-size").style("display", "none");
            }

            // Alerta de código muerto para el nodo seleccionado
            const deadcodeContainer = d3.select("#inspector-deadcode");
            if (esCodigoMuerto(d)) {
                deadcodeContainer.style("display", "block").html(
                    '<div class="deadcode-alert-title">⚠️ Código Muerto / Archivo Huérfano</div>' +
                    '<div class="deadcode-alert-detail">' +
                        'Este archivo local no tiene importaciones entrantes (in-degree 0) y no parece ser un punto de entrada de la aplicación.' +
                    '</div>'
                );
            } else {
                deadcodeContainer.style("display", "none");
            }

            // Alerta de God File para el nodo seleccionado
            const godContainer = d3.select("#inspector-godfile");
            if (d.type === 'local') {
                const stats = calcularMetricasGod(d);
                if (stats.esGod) {
                    godContainer.style("display", "block").html(
                        '<div class="godfile-alert-title">⚠️ God File Detectado (Score: ' + stats.score + ')</div>' +
                        '<div class="godfile-alert-detail">' +
                            'Este componente es altamente complejo (' + stats.complexity + ' LOC) y posee un acoplamiento elevado (' + stats.coupling + ' conexiones). ' +
                            'Se sugiere dividirlo en componentes o hooks independientes para mejorar la cohesión y mantenibilidad.' +
                        '</div>'
                    );
                } else {
                    godContainer.style("display", "none");
                }
            } else {
                godContainer.style("display", "none");
            }

            // Alerta de Seguridad para el nodo seleccionado
            const securityContainer = d3.select("#inspector-security");
            if (d.hasSecurity && d.securityAlerts && d.securityAlerts.length > 0) {
                const escapeHtml = (text) => {
                    if (!text) return '';
                    return text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };

                let html = '<div class="security-alert-title" style="margin-bottom: 8px;">🛡️ Diagnóstico de Seguridad</div>';
                
                d.securityAlerts.forEach((alert, index) => {
                    if (index > 0) {
                        html += '<hr style="border: 0; border-top: 1px solid rgba(255, 60, 56, 0.25); margin: 12px 0 8px 0;" />';
                    }
                    
                    html += '<div style="margin-bottom: 6px;">';
                    html += '  <strong style="color: #ff3c38; font-size: 11px;">⚠️ ' + escapeHtml(alert.message) + '</strong>';
                    html += '</div>';
                    
                    // Show line number and code snippet if available
                    if (alert.line !== undefined && alert.snippet !== undefined) {
                        html += '<div class="security-alert-code">';
                        html += '  <span style="color: #ff8b8b; font-weight: 600; margin-right: 6px;">Línea ' + alert.line + ':</span>';
                        html += '  <code>' + escapeHtml(alert.snippet) + '</code>';
                        html += '</div>';
                    }
                    
                    // Show risk details if available
                    if (alert.risk) {
                        html += '<div style="margin-top: 6px; font-size: 11px; color: var(--vscode-sideBar-foreground, #ccc); opacity: 0.95; line-height: 1.45;">';
                        html += '  <strong style="color: #ff8b8b;">Riesgo:</strong> ' + escapeHtml(alert.risk);
                        html += '</div>';
                    }
                    
                    // Show recommendation if available
                    if (alert.recommendation) {
                        html += '<div style="margin-top: 6px; font-size: 11px; color: #2ec4b6; opacity: 0.95; line-height: 1.45;">';
                        html += '  <strong style="color: #6ee7b7;">Recomendación:</strong> ' + escapeHtml(alert.recommendation);
                        html += '</div>';
                    }
                });
                
                securityContainer.style("display", "block").html(html);
            } else {
                securityContainer.style("display", "none");
            }

            // Alertas de violación de arquitectura para el nodo seleccionado (como origen/importador)
            const violations = activeLinks.filter(l => (l.source?.id || l.source) === d.id && l.violation);
            const violationContainer = d3.select("#inspector-violation");
            if (violations.length > 0) {
                violationContainer.style("display", "block").html("");
                violationContainer.append("div")
                    .attr("class", "violation-alert-title")
                    .html("⚠️ Infracción Arquitectónica");
                
                violations.forEach(v => {
                    violationContainer.append("div")
                        .attr("class", "violation-alert-detail")
                        .text(v.violationDetails);
                });
            } else {
                violationContainer.style("display", "none");
            }

            // Alertas de ciclos en los que participa el nodo
            const cycleContainer = d3.select("#inspector-cycle");
            if (d.inCycle && d.cycles && d.cycles.length > 0) {
                cycleContainer.style("display", "block").html("");
                cycleContainer.append("div")
                    .attr("class", "cycle-alert-title")
                    .html("⚠️ Dependencia Circular");
                
                d.cycles.forEach(c => {
                    const pathDiv = cycleContainer.append("div")
                        .attr("class", "cycle-alert-detail")
                        .style("margin-top", "6px");
                    
                    c.path.forEach((nodeId, idx) => {
                        if (idx > 0) {
                            pathDiv.append("span").text(" ➔ ");
                        }
                        
                        const name = nodeId.split('/').pop();
                        pathDiv.append("span")
                            .attr("class", "cycle-path-step")
                            .text(name)
                            .attr("title", nodeId)
                            .on("click", (e) => {
                                e.stopPropagation();
                                const targetNode = data.nodes.find(n => n.id === nodeId);
                                if (targetNode) {
                                    handleNodeClick(e, targetNode);
                                }
                            });
                    });
                });
            } else {
                cycleContainer.style("display", "none");
            }

            // Configurar panel de análisis de impacto (Blast Radius)
            const blastContainer = d3.select("#inspector-blast").style("display", "flex").html("");
            
            if (activeBlastSource === d.id) {
                const count = impactedNodesSet.size;
                const totalLocales = activeNodes.filter(n => n.type === 'local').length;
                const pct = totalLocales > 0 ? Math.round((count / totalLocales) * 100) : 0;
                
                const metricBox = blastContainer.append("div").attr("class", "blast-metric-box");
                metricBox.append("div").attr("class", "blast-metric-title").text("💥 Radio de Explosión");
                metricBox.append("div").text(count + " de " + totalLocales + " componentes locales afectados (" + pct + "%)");
                
                if (count > 0) {
                    const listTitle = metricBox.append("div")
                        .style("font-weight", "600")
                        .style("margin-top", "6px")
                        .text("Archivos afectados:");
                    
                    const listDiv = metricBox.append("div")
                        .style("max-height", "70px")
                        .style("overflow-y", "auto")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("gap", "4px")
                        .style("margin-top", "4px");
                    
                    impactedNodesSet.forEach(nodeId => {
                        const name = nodeId.split('/').pop();
                        listDiv.append("div")
                            .attr("class", "inspector-item")
                            .text(name)
                            .attr("title", nodeId)
                            .on("click", (e) => {
                                e.stopPropagation();
                                const targetNode = data.nodes.find(n => n.id === nodeId);
                                if (targetNode) {
                                    handleNodeClick(e, targetNode);
                                }
                            });
                    });
                }

                blastContainer.append("button")
                    .attr("class", "blast-btn reset")
                    .text("Limpiar Análisis")
                    .on("click", (e) => {
                        e.stopPropagation();
                        limpiarBlastRadius();
                        highlightSelectedNode(d); // refrescar UI
                    });
            } else {
                if (d.type === 'local') {
                    blastContainer.append("button")
                        .attr("class", "blast-btn")
                        .text("Ver Radio de Impacto")
                        .on("click", (e) => {
                            e.stopPropagation();
                            iniciarBlastRadius(d.id);
                            highlightSelectedNode(d); // refrescar UI
                        });
                } else {
                    blastContainer.style("display", "none");
                }
            }

            // Dependencias (salientes)
            const outgoing = activeLinks.filter(l => (l.source?.id || l.source) === d.id);
            d3.select("#ins-out-count").text(outgoing.length);
            const outList = d3.select("#ins-out-list").html("");
            outgoing.forEach(l => {
                const targetNode = activeNodes.find(n => n.id === (l.target?.id || l.target));
                if (targetNode) {
                    outList.append("div")
                        .attr("class", "inspector-item")
                        .text(targetNode.name)
                        .on("click", (e) => {
                            e.stopPropagation();
                            const n = data.nodes.find(node => node.id === targetNode.id);
                            if (n) handleNodeClick(e, n);
                        });
                }
            });

            // Dependientes (entrantes)
            const incoming = activeLinks.filter(l => (l.target?.id || l.target) === d.id);
            d3.select("#ins-in-count").text(incoming.length);
            const inList = d3.select("#ins-in-list").html("");
            incoming.forEach(l => {
                const sourceNode = activeNodes.find(n => n.id === (l.source?.id || l.source));
                if (sourceNode) {
                    inList.append("div")
                        .attr("class", "inspector-item")
                        .text(sourceNode.name)
                        .on("click", (e) => {
                            e.stopPropagation();
                            const n = data.nodes.find(node => node.id === sourceNode.id);
                            if (n) handleNodeClick(e, n);
                        });
                }
            });
        }

        function esConectado(id1, id2) {
            return activeLinks.some(l => {
                const sId = l.source?.id || l.source;
                const tId = l.target?.id || l.target;
                return (sId === id1 && tId === id2) || (sId === id2 && tId === id1);
            });
        }

        function deselectNode() {
            selectedNode = null;
            
            const highlightDead = d3.select("#toggle-deadcode").property("checked");
            const highlightGod = d3.select("#toggle-godfiles").property("checked");
            const highlightCycles = d3.select("#toggle-cycles").property("checked");
            const highlightSecurity = d3.select("#toggle-security").property("checked");
            const searchQuery = d3.select("#search-input").property("value").toLowerCase().trim();

            if (highlightDead) {
                mostrarReporteGeneralCodigoMuerto();
            } else if (highlightGod) {
                mostrarReporteGeneralGodFiles();
            } else if (highlightSecurity) {
                mostrarReporteGeneralSeguridad();
            } else {
                d3.select("#inspector").style("display", "none");
            }

            if (activeBlastSource) {
                node.style("opacity", n => n.id === activeBlastSource || impactedNodesSet.has(n.id) ? 1 : 0.08)
                    .classed("impact-source", n => n.id === activeBlastSource)
                    .classed("impacted", n => impactedNodesSet.has(n.id));
                label.style("opacity", n => n.id === activeBlastSource || impactedNodesSet.has(n.id) ? 1 : 0.08);
                link.style("opacity", l => {
                    const sId = l.source?.id || l.source;
                    const tId = l.target?.id || l.target;
                    const isImpactLink = (tId === activeBlastSource || impactedNodesSet.has(tId)) && impactedNodesSet.has(sId);
                    return isImpactLink ? 0.95 : 0.02;
                });
            } else if (highlightDead) {
                node.classed("cycle-highlight", false).classed("impact-source", false).classed("impacted", false).classed("god-highlight", false).classed("security-highlight", false);
                link.classed("cycle", false).classed("impact-path", false);

                node.style("opacity", n => esCodigoMuerto(n) ? 1.0 : 0.1)
                    .classed("dead-highlight", n => esCodigoMuerto(n));
                label.style("opacity", n => esCodigoMuerto(n) ? 1.0 : 0.1);
                link.style("opacity", 0.02);
            } else if (highlightGod) {
                node.classed("cycle-highlight", false).classed("impact-source", false).classed("impacted", false).classed("dead-highlight", false).classed("security-highlight", false);
                link.classed("cycle", false).classed("impact-path", false);

                node.style("opacity", n => calcularMetricasGod(n).esGod ? 1.0 : 0.15)
                    .classed("god-highlight", n => calcularMetricasGod(n).esGod);
                label.style("opacity", n => calcularMetricasGod(n).esGod ? 1.0 : 0.15);
                link.style("opacity", 0.05);
            } else if (highlightSecurity) {
                node.classed("cycle-highlight", false).classed("impact-source", false).classed("impacted", false).classed("dead-highlight", false).classed("god-highlight", false);
                link.classed("cycle", false).classed("impact-path", false);

                node.style("opacity", n => n.hasSecurity ? 1.0 : 0.1)
                    .classed("security-highlight", n => n.hasSecurity);
                label.style("opacity", n => n.hasSecurity ? 1.0 : 0.1);
                link.style("opacity", 0.02);
            } else if (highlightCycles) {
                node.classed("dead-highlight", false).classed("god-highlight", false).classed("security-highlight", false);
                node.style("opacity", n => n.inCycle ? 1 : 0.1)
                    .classed("cycle-highlight", n => n.inCycle);
                label.style("opacity", n => n.inCycle ? 1 : 0.1);
                link.style("opacity", l => l.inCycle ? 0.95 : 0.05)
                    .classed("cycle", l => l.inCycle);
            } else {
                node.classed("cycle-highlight", false).classed("impact-source", false).classed("impacted", false).classed("dead-highlight", false).classed("god-highlight", false).classed("security-highlight", false);
                link.classed("cycle", false).classed("impact-path", false);
                node.style("opacity", 1);
                label.style("opacity", 1).style("fill", "var(--vscode-descriptionForeground, #c9ada7)");
                link.style("opacity", d => d.violation ? 0.85 : 0.4).classed("highlighted", false);

                if (searchQuery) {
                    node.style("opacity", n => n.name.toLowerCase().includes(searchQuery) ? 1 : 0.15);
                    label.style("opacity", n => n.name.toLowerCase().includes(searchQuery) ? 1 : 0.15);
                    link.style("opacity", 0.05);
                }
            }
        }

        svg.on("click", (event) => {
            if (event.target.tagName === 'svg') {
                deselectNode();
            }
        });

        function handleMouseOver(event, d) {
            if (selectedNode) return; // Ignorar hover si hay un nodo seleccionado
            const highlightCycles = d3.select("#toggle-cycles").property("checked");
            if (highlightCycles && !d.inCycle) return; // Ignorar hover de nodos no cíclicos si resaltamos ciclos
            if (activeBlastSource && d.id !== activeBlastSource && !impactedNodesSet.has(d.id)) return; // Ignorar hover si no es del radio de impacto

            const rBase = obtenerRadioNodo(d);
            d3.select(this).attr("r", rBase + 4);
            link.classed("highlighted", l => {
                const sId = l.source?.id || l.source;
                const tId = l.target?.id || l.target;
                return sId === d.id || tId === d.id;
            });
            
            const connectedNodeIds = new Set();
            connectedNodeIds.add(d.id);
            activeLinks.forEach(l => {
                const sourceId = l.source?.id || l.source;
                const targetId = l.target?.id || l.target;
                if (sourceId === d.id) connectedNodeIds.add(targetId);
                if (targetId === d.id) connectedNodeIds.add(sourceId);
            });
            label.classed("highlighted", n => connectedNodeIds.has(n.id));
        }

        function handleMouseOut(event, d) {
            if (selectedNode) return; // Ignorar hover si hay un nodo seleccionado
            d3.select(this).attr("r", obtenerRadioNodo(d));
            link.classed("highlighted", false);
            label.classed("highlighted", false);
        }

        function handleDoubleClick(event, d) {
            if (d.type === 'local') {
                vscode.postMessage({
                    command: 'abrirArchivo',
                    ruta: d.id
                });
            }
        }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Escuchar mensajes provenientes de la extensión VS Code para actualizar el grafo en tiempo real
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'actualizarGrafo') {
                const nuevoGrafo = message.grafo;
                
                // 1. Actualizar datos globales
                data.nodes = nuevoGrafo.nodes;
                data.links = nuevoGrafo.links;
                data.npmVulnerabilities = nuevoGrafo.npmVulnerabilities;
                data.cycles = nuevoGrafo.cycles;

                // 2. Recalcular grados de entrada (in-degree)
                for (const key in inDegree) delete inDegree[key];
                data.nodes.forEach(n => inDegree[n.id] = 0);
                data.links.forEach(l => {
                    const targetId = l.target?.id || l.target;
                    if (inDegree[targetId] !== undefined) {
                        inDegree[targetId]++;
                    }
                });

                // 3. Mantener e inspeccionar el nodo seleccionado si sigue existiendo
                if (selectedNode) {
                    const nodoEquivalente = data.nodes.find(n => n.id === selectedNode.id);
                    if (nodoEquivalente) {
                        selectedNode = nodoEquivalente;
                        highlightSelectedNode(selectedNode);
                    } else {
                        deselectNode();
                    }
                }

                // 4. Actualizar nodos y enlaces en la simulación de D3
                simulation.nodes(data.nodes);
                simulation.force("link").links(data.links);
                
                // 5. Actualizar la visualización de la pestaña del stack de tecnología
                renderizarTechStack();

                // 6. Re-renderizar el grafo con los nuevos datos
                render();
            }
        });

        function renderizarTechStack() {
            const stack = data.techStack || {};
            d3.select("#tech-framework").text(stack.framework || 'React (Cliente)');
            d3.select("#tech-state-local").text(stack.stateLocal || 'React Context / Local State');
            d3.select("#tech-state-server").text(stack.stateServer || 'Fetch API / Nativo');
            d3.select("#tech-validation").text(stack.validation || 'TypeScript');
            d3.select("#tech-styling").text(stack.styling || 'CSS nativo');
            d3.select("#tech-forms").text(stack.forms || 'Formularios nativos');
            d3.select("#tech-ui").text(stack.uiComponents || 'Ninguno');
        }

        // Navegación de Pestañas (Tabs) en el panel de controles
        d3.select("#tab-filters").on("click", function() {
            d3.select("#tab-filters").classed("active", true);
            d3.select("#tab-tech").classed("active", false);
            d3.select("#filters-panel").style("display", "block");
            d3.select("#tech-stack-panel").style("display", "none");
        });

        d3.select("#tab-tech").on("click", function() {
            d3.select("#tab-tech").classed("active", true);
            d3.select("#tab-filters").classed("active", false);
            d3.select("#tech-stack-panel").style("display", "flex");
            d3.select("#filters-panel").style("display", "none");
            renderizarTechStack();
        });

        // Inicializar renderizado del stack
        renderizarTechStack();