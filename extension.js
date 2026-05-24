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

                // Escuchamos mensajes del webview para abrir archivos
                panel.webview.onDidReceiveMessage(message => {
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
                    }
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
