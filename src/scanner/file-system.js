const fs = require('fs');
const path = require('path');

// Resuelve rutas de importación relativas incluyendo extensiones omitidas o carpetas /index
function resolverRuta(rutaProyecto, contenedorDir, importPath, extensionesPermitidas) {
    if (!importPath.startsWith('.')) {
        return importPath;
    }

    const rutaAbsoluta = path.resolve(contenedorDir, importPath);
    
    for (const ext of extensionesPermitidas) {
        const rutaConExt = rutaAbsoluta + ext;
        if (fs.existsSync(rutaConExt) && fs.statSync(rutaConExt).isFile()) {
            const relResuelta = path.relative(rutaProyecto, rutaConExt);
            return relResuelta.replace(/\\/g, '/');
        }
    }

    const relAproximada = path.relative(rutaProyecto, rutaAbsoluta);
    return relAproximada.replace(/\\/g, '/');
}

function escanearDirectorio(directorio, excluidos, callbackArchivo) {
    const baseName = path.basename(directorio);
    if (excluidos.includes(baseName)) {
        return;
    }

    const archivos = fs.readdirSync(directorio);

    for (const archivo of archivos) {
        const rutaCompleta = path.join(directorio, archivo);
        const stats = fs.statSync(rutaCompleta);

        if (stats.isDirectory()) {
            escanearDirectorio(rutaCompleta, excluidos, callbackArchivo);
        } else {
            callbackArchivo(rutaCompleta, stats.size, archivo, directorio);
        }
    }
}

module.exports = { resolverRuta, escanearDirectorio };
