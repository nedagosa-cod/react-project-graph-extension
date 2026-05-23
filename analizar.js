// analizar.js
import fs from 'fs';
import { obtenerGrafo } from './scanner.js';

console.log('🚀 Escaneando el proyecto y construyendo el grafo...');
// Escaneamos el directorio de trabajo actual
const grafo = obtenerGrafo(process.cwd());

console.log('\n🖥️ Generando interfaz visual estilo Obsidian (index.html)...');

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grafo de Dependencias - Estilo Obsidian</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            margin: 0;
            background-color: #121212;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
            user-select: none;
        }
        #grafo {
            width: 100vw;
            height: 100vh;
        }
        .nodo {
            stroke: #1e1e1e;
            stroke-width: 1.5px;
            cursor: grab;
            transition: fill 0.2s, r 0.2s, stroke-width 0.2s;
        }
        .nodo:active {
            cursor: grabbing;
        }
        /* Colores por tipo de nodo */
        .nodo.local {
            fill: #7b2cbf;
        }
        .nodo.external {
            fill: #00b4d8;
        }
        .nodo.missing {
            fill: #e63946;
            stroke: #ffb703;
            stroke-dasharray: 3, 3;
        }
        /* Efectos hover */
        .nodo:hover {
            stroke: #fff;
            stroke-width: 2.5px;
            filter: brightness(1.2);
        }
        .enlace {
            stroke: #4a4a4a;
            stroke-opacity: 0.4;
            stroke-width: 1.5px;
            transition: stroke-opacity 0.2s, stroke-width 0.2s;
        }
        .enlace.highlighted {
            stroke: #ffb703;
            stroke-opacity: 1;
            stroke-width: 2.5px;
        }
        .etiqueta {
            fill: #c9ada7;
            font-size: 11px;
            pointer-events: none;
            text-anchor: middle;
            font-weight: 500;
            transition: fill 0.2s, font-size 0.2s;
        }
        .etiqueta.highlighted {
            fill: #fff;
            font-size: 13px;
            text-shadow: 0 0 4px rgba(0,0,0,0.8);
        }
        /* Leyenda flotante */
        #legend {
            position: absolute;
            bottom: 24px;
            left: 24px;
            background: rgba(25, 25, 25, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: auto;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .legend-title {
            font-weight: 600;
            margin-bottom: 4px;
            color: #fff;
            font-size: 14px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .color-box {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        }
        .color-box.local { background-color: #7b2cbf; border: 1px solid #1e1e1e; }
        .color-box.external { background-color: #00b4d8; border: 1px solid #1e1e1e; }
        .color-box.missing { background-color: #e63946; border: 1px dashed #ffb703; }
    </style>
</head>
<body>

    <svg id="grafo"></svg>

    <div id="legend">
        <div class="legend-title">Grafo de Dependencias</div>
        <div class="legend-item">
            <span class="color-box local"></span>
            <span>Archivos Locales (.js, .jsx)</span>
        </div>
        <div class="legend-item">
            <span class="color-box external"></span>
            <span>Módulos Externos (npm / react)</span>
        </div>
        <div class="legend-item">
            <span class="color-box missing"></span>
            <span>Importación Faltante / No Encontrada</span>
        </div>
    </div>

    <script>
        const data = ${JSON.stringify(grafo)};

        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3.select("#grafo")
            .attr("width", width)
            .attr("height", height);

        // Agregamos capacidad de Zoom e inclinación
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
            .force("collision", d3.forceCollide().radius(40));

        const link = g.append("g")
            .attr("class", "enlaces")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", "enlace");

        const node = g.append("g")
            .attr("class", "nodos")
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("class", d => "nodo " + (d.type || "local"))
            .attr("r", d => d.type === 'external' ? 7 : d.type === 'missing' ? 8 : 10)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut);

        const label = g.append("g")
            .attr("class", "etiquetas")
            .selectAll("text")
            .data(data.nodes)
            .enter().append("text")
            .attr("class", "etiqueta")
            .attr("dy", -15)
            .text(d => d.name);

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

        // Interactividad: Resaltar conexiones al pasar el mouse
        function handleMouseOver(event, d) {
            // Agrandar nodo seleccionado
            d3.select(this).attr("r", d.type === 'external' ? 10 : d.type === 'missing' ? 11 : 14);

            // Resaltar los enlaces que salen o entran al nodo
            link.classed("highlighted", l => l.source.id === d.id || l.target.id === d.id);
            
            // Resaltar etiquetas de los nodos conectados
            const connectedNodeIds = new Set();
            connectedNodeIds.add(d.id);
            data.links.forEach(l => {
                if (l.source.id === d.id) connectedNodeIds.add(l.target.id);
                if (l.target.id === d.id) connectedNodeIds.add(l.source.id);
            });

            label.classed("highlighted", n => connectedNodeIds.has(n.id));
        }

        function handleMouseOut(event, d) {
            // Restaurar tamaño de nodo
            d3.select(this).attr("r", d.type === 'external' ? 7 : d.type === 'missing' ? 8 : 10);
            
            // Quitar resaltados
            link.classed("highlighted", false);
            label.classed("highlighted", false);
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
    </script>
</body>
</html>
`;

// Guarda el archivo HTML en tu disco
fs.writeFileSync('./index.html', htmlContent, 'utf8');
console.log('✨ ¡Hecho! Se ha actualizado "index.html".');
console.log('\n💡 Para ver el grafo interactivo y evitar errores de seguridad "file://", inicia el servidor local:');
console.log('   npm start');
console.log('   (o abre http://localhost:3000 después de iniciar)\n');
