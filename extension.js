// extension.js
const vscode = require('vscode');
const { obtenerGrafo } = require('./src/scanner.js');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log('¡La extensión "React Project Graph" está activa!');

    let disposable = vscode.commands.registerCommand('antigravity-react-project-graph.showGraph', async function () {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Abre un proyecto de React con carpeta para poder ver el grafo.');
            return;
        }

        const rutaProyecto = workspaceFolders[0].uri.fsPath;

        // Detectar si hay un archivo activo en el editor
        const activeEditor = vscode.window.activeTextEditor;
        let activeFileId = null;
        let activeFileName = '';
        if (activeEditor) {
            const activeFilePath = activeEditor.document.uri.fsPath;
            if (activeFilePath.startsWith(rutaProyecto)) {
                activeFileId = path.relative(rutaProyecto, activeFilePath).replace(/\\/g, '/');
                activeFileName = path.basename(activeFilePath);
            }
        }

        let nodoEnfocadoId = null;

        // Si hay archivo activo, preguntar al usuario qué vista abrir
        if (activeFileId) {
            const opciones = [
                {
                    label: `🌐 Abrir Grafo Completo (General)`,
                    description: 'Muestra la vista global de todo el proyecto'
                },
                {
                    label: `🎯 Abrir Grafo Enfocado en: ${activeFileName}`,
                    description: `Focaliza e inspecciona automáticamente el archivo ${activeFileName}`,
                    id: activeFileId
                }
            ];

            const seleccion = await vscode.window.showQuickPick(opciones, {
                placeHolder: '¿Cómo deseas visualizar el grafo de dependencias?'
            });

            if (!seleccion) {
                // Cancelado
                return;
            }

            if (seleccion.id) {
                nodoEnfocadoId = seleccion.id;
            }
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "React Project Graph",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Escaneando archivos y construyendo grafo..." });
            
            try {
                const grafo = obtenerGrafo(rutaProyecto);

                if (grafo.nodes.length === 0) {
                    vscode.window.showWarningMessage('No se encontraron archivos JavaScript/React en la carpeta "src" de este proyecto.');
                    return;
                }

                const panel = vscode.window.createWebviewPanel(
                    'reactProjectGraph',
                    'Grafo de Dependencias: ' + workspaceFolders[0].name,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                panel.webview.html = obtenerHtmlWebview(context, panel, grafo, nodoEnfocadoId);

                // Escuchamos mensajes del webview para abrir archivos o exportar markdown
                panel.webview.onDidReceiveMessage(async message => {
                    if (message.command === 'abrirArchivo') {
                        const rutaCompleta = path.join(rutaProyecto, message.ruta);
                        vscode.workspace.openTextDocument(rutaCompleta).then(
                            doc => {
                                vscode.window.showTextDocument(doc);
                            },
                            err => {
                                vscode.window.showErrorMessage('No se pudo abrir el archivo: ' + err.message);
                            }
                        );
                    } else if (message.command === 'exportarMarkdown') {
                        try {
                            const grafoActual = obtenerGrafo(rutaProyecto);
                            const contenidoMd = generarContenidoMarkdown(grafoActual);
                            const rutaArchivo = path.join(rutaProyecto, 'project_architecture.md');
                            fs.writeFileSync(rutaArchivo, contenidoMd, 'utf8');
                            vscode.window.showInformationMessage('¡Plano arquitectónico de IA exportado a "project_architecture.md" con éxito!');
                        } catch (error) {
                            vscode.window.showErrorMessage('Error al exportar arquitectura en Markdown: ' + error.message);
                        }
                    }
                });

                // Suscribirse a cambios al guardar archivos para actualizar el grafo en tiempo real
                const saveSubscription = vscode.workspace.onDidSaveTextDocument(document => {
                    const filePath = document.uri.fsPath;
                    if (filePath.startsWith(rutaProyecto)) {
                        const ext = path.extname(filePath).toLowerCase();
                        if (['.js', '.jsx', '.ts', '.tsx', '.json'].includes(ext)) {
                            try {
                                const nuevoGrafo = obtenerGrafo(rutaProyecto);
                                panel.webview.postMessage({
                                    command: 'actualizarGrafo',
                                    grafo: nuevoGrafo
                                });
                            } catch (err) {
                                console.error('Error al actualizar el grafo de dependencias:', err);
                            }
                        }
                    }
                });

                panel.onDidDispose(() => {
                    saveSubscription.dispose();
                });

            } catch (error) {
                vscode.window.showErrorMessage('Error al generar el grafo: ' + error.message);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function obtenerHtmlWebview(context, panel, grafo, nodoEnfocadoId) {
    const extensionPath = context.extensionPath;
    
    // Rutas de archivos de recursos en el disco
    const stylesPath = path.join(extensionPath, 'src', 'webview', 'styles.css');
    const appPath = path.join(extensionPath, 'src', 'webview', 'app.js');
    const viewPath = path.join(extensionPath, 'src', 'webview', 'view.html');
    
    // Convertirlas a URIs que el Webview pueda cargar de forma segura
    const stylesUri = panel.webview.asWebviewUri(vscode.Uri.file(stylesPath));
    const appUri = panel.webview.asWebviewUri(vscode.Uri.file(appPath));
    
    // Leer el archivo HTML base
    let html = fs.readFileSync(viewPath, 'utf8');
    
    // Reemplazar los marcadores dinámicos por sus valores correspondientes
    html = html
        .replace('{{stylesUri}}', stylesUri.toString())
        .replace('{{appUri}}', appUri.toString())
        .replace('{{initialFocusedNodeId}}', JSON.stringify(nodoEnfocadoId))
        .replace('{{grafoData}}', JSON.stringify(grafo));

    return html;
}
        
function generarContenidoMarkdown(grafo) {
    let md = `# Plano de Arquitectura del Proyecto (Alta Densidad - Optimizado para IA)\n\n`;
    md += `Este archivo contiene la estructura jerárquica, relaciones de importación y auditorías de seguridad en un formato supercondensado de alta densidad. Está optimizado para minimizar el consumo de tokens y maximizar la precisión en asistentes de IA (como Cursor, Windsurf o Antigravity).\n\n`;
    
    // 1. Resumen Estadístico
    const locales = grafo.nodes.filter(n => n.type === 'local');
    const externos = grafo.nodes.filter(n => n.type === 'external');
    const faltantes = grafo.nodes.filter(n => n.type === 'missing');
    const vulnerabilidadesCount = locales.filter(n => n.hasSecurity).reduce((acc, n) => acc + (n.securityAlerts ? n.securityAlerts.length : 0), 0);
    
    md += `## 📊 Resumen Ejecutivo\n`;
    md += `- **Módulos Locales:** ${locales.length} | **npm Externos:** ${externos.length} | **Faltantes:** ${faltantes.length}\n`;
    md += `- **Ciclos Circulares:** ${grafo.cycles ? grafo.cycles.length : 0} | **Riesgos de Seguridad:** ${vulnerabilidadesCount}\n\n`;

    // 1.5 Stack Tecnológico del Proyecto
    const stack = grafo.techStack || {};
    md += `## 🛠️ Stack Tecnológico & Integraciones Clave\n`;
    md += `- **Framework / Core:** ${stack.framework || 'React (Cliente)'}\n`;
    md += `- **Gestión de Estado Local:** ${stack.stateLocal || 'React Context / Local State'}\n`;
    md += `- **Gestión de Estado Servidor:** ${stack.stateServer || 'Fetch API / Nativo'}\n`;
    md += `- **Tipado & Validación:** ${stack.validation || 'Ninguno (JS nativo)'}\n`;
    md += `- **Estilos & CSS:** ${stack.styling || 'CSS nativo'}\n`;
    if (stack.forms) md += `- **Formularios:** ${stack.forms}\n`;
    if (stack.uiComponents) md += `- **Componentes UI:** ${stack.uiComponents}\n`;
    md += `\n`;

    // 2. Capas de Arquitectura
    md += `## 🗂️ Capas de Arquitectura Limpia\n`;
    const capas = ['domain', 'data', 'hooks', 'logic', 'presentation', 'asset', 'external', 'missing'];
    const nombresCapas = {
        domain: 'Dominio (Tipos/Modelos)',
        data: 'Infraestructura (Datos/API/Utils)',
        hooks: 'Aplicación (Hooks)',
        logic: 'Negocio (Estado/Contexto)',
        presentation: 'Presentación (UI/Vistas)',
        asset: 'Recursos (Assets/Styles/JSON)',
        external: 'Módulos Externos (npm)',
        missing: 'Importaciones Faltantes'
    };

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

    // 3. Mapa Detallado de Relaciones / Dependencias
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

    // 4. Auditoría de Seguridad & Riesgos
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
        
        // npm vulnerabilities
        const npmVulnerabilities = grafo.npmVulnerabilities || [];
        npmVulnerabilities.forEach(v => {
            md += `- 📦 **Módulo npm: \`${v.package}\` (${v.declared})** | ${v.risk}\n`;
        });
        md += `\n`;
    }

    // 5. Dependencias Circulares
    if (grafo.cycles && grafo.cycles.length > 0) {
        md += `## 🔄 Dependencias Circulares (Ciclos)\n`;
        grafo.cycles.forEach((ciclo, idx) => {
            md += `- **Ciclo #${idx + 1}:** \`${ciclo.join(' ➔ ')}\`\n`;
        });
    }

    return md;
}

function deactivate() {}

module.exports = { activate, deactivate };
