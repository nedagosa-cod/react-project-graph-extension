const vscode = require('vscode');
const { obtenerGrafo } = require('./src/scanner/index.js');
const { generarContenidoMarkdown } = require('./src/scanner/markdown-export.js');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log('¡La extensión "Project Graph" está activa!');

    let disposable = vscode.commands.registerCommand('antigravity-project-graph.showGraph', async function () {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Abre un proyecto con carpeta para poder ver el grafo.');
            return;
        }

        const rutaProyecto = workspaceFolders[0].uri.fsPath;

        // Detección de entorno (Raíz y Nivel 1)
        let hasFrontend = false;
        let hasBackendNode = false;
        let hasBackendPython = false;
        
        let pathFrontend = rutaProyecto;
        let pathBackendNode = rutaProyecto;
        let pathBackendPython = rutaProyecto;
        
        try {
            const checkFile = (dir, file) => fs.existsSync(path.join(dir, file));
            
            const evaluarPackageJson = (dir) => {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
                    const deps = { ...(content.dependencies || {}), ...(content.devDependencies || {}) };
                    if (deps['@nestjs/core'] || deps['express'] || deps['fastify']) {
                        hasBackendNode = true;
                        pathBackendNode = dir;
                    } else {
                        hasFrontend = true;
                        pathFrontend = dir;
                    }
                } catch (e) {}
            };

            // 1. Revisar raíz
            if (checkFile(rutaProyecto, 'package.json')) evaluarPackageJson(rutaProyecto);
            if (checkFile(rutaProyecto, 'requirements.txt') || checkFile(rutaProyecto, 'pyproject.toml') || checkFile(rutaProyecto, 'Pipfile') || checkFile(rutaProyecto, 'setup.py')) {
                hasBackendPython = true;
                pathBackendPython = rutaProyecto;
            }
            
            // 2. Revisar directorios de primer nivel
            const items = fs.readdirSync(rutaProyecto);
            for (const item of items) {
                const subPath = path.join(rutaProyecto, item);
                if (fs.statSync(subPath).isDirectory() && !['node_modules', '.git', '.vscode', '.venv', 'venv'].includes(item)) {
                    if (checkFile(subPath, 'package.json')) evaluarPackageJson(subPath);
                    if (!hasBackendPython && (checkFile(subPath, 'requirements.txt') || checkFile(subPath, 'pyproject.toml') || checkFile(subPath, 'Pipfile') || checkFile(subPath, 'setup.py'))) {
                        hasBackendPython = true;
                        pathBackendPython = subPath;
                    }
                }
            }
        } catch (e) {
            console.error("Error al detectar entorno:", e);
        }
        
        let entornosDisponibles = [];
        if (hasFrontend) entornosDisponibles.push({ label: '🌐 Grafo Frontend (React/Vue/Etc)', value: 'frontend', rutaTarget: pathFrontend });
        if (hasBackendNode) entornosDisponibles.push({ label: '⚙️ Grafo Backend (Node.js/NestJS)', value: 'backend-node', rutaTarget: pathBackendNode });
        if (hasBackendPython) entornosDisponibles.push({ label: '🐍 Grafo Backend (Python)', value: 'backend', rutaTarget: pathBackendPython });
        
        if (entornosDisponibles.length === 0) {
            entornosDisponibles.push({ label: '🌐 Grafo Predeterminado (JS/TS)', value: 'frontend', rutaTarget: rutaProyecto });
        }
        
        let entornoSeleccionado = entornosDisponibles[0].value;
        let rutaEspecifica = entornosDisponibles[0].rutaTarget || rutaProyecto;
        
        if (entornosDisponibles.length > 1) {
            const seleccionEntorno = await vscode.window.showQuickPick(entornosDisponibles, {
                placeHolder: 'Proyecto Mixto: ¿Qué grafo deseas visualizar?'
            });
            if (!seleccionEntorno) return;
            entornoSeleccionado = seleccionEntorno.value;
            rutaEspecifica = seleccionEntorno.rutaTarget || rutaProyecto;
        }

        // Detectar si hay un archivo activo en el editor
        const activeEditor = vscode.window.activeTextEditor;
        let activeFileId = null;
        let activeFileName = '';
        if (activeEditor) {
            const activeFilePath = activeEditor.document.uri.fsPath;
            if (activeFilePath.startsWith(rutaEspecifica)) {
                activeFileId = path.relative(rutaEspecifica, activeFilePath).replace(/\\/g, '/');
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
            title: "Project Graph",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Escaneando archivos y construyendo grafo..." });
            
            try {
                // PASAMOS RUTA ESPECÍFICA EN VEZ DE LA RAÍZ DEL ESPACIO DE TRABAJO
                const grafo = obtenerGrafo(rutaEspecifica, entornoSeleccionado);

                if (grafo.nodes.length === 0) {
                    vscode.window.showWarningMessage('No se encontraron archivos válidos en este proyecto para el entorno seleccionado.');
                    return;
                }

                const panel = vscode.window.createWebviewPanel(
                    'projectGraph',
                    `Grafo de Dependencias: ${workspaceFolders[0].name}`,
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
                            const grafoActual = obtenerGrafo(rutaEspecifica, entornoSeleccionado);
                            const contenidoMd = generarContenidoMarkdown(grafoActual);
                            const rutaArchivo = path.join(rutaEspecifica, 'project_architecture.md');
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
                    if (filePath.startsWith(rutaEspecifica)) {
                        const ext = path.extname(filePath).toLowerCase();
                        if (['.js', '.jsx', '.ts', '.tsx', '.json', '.py'].includes(ext)) {
                            try {
                                const nuevoGrafo = obtenerGrafo(rutaEspecifica, entornoSeleccionado);
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
        
function deactivate() {}

module.exports = { activate, deactivate };
