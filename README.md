# Obsidian React Graph 📍

**Obsidian React Graph** es una extensión premium de VS Code diseñada para líderes técnicos y arquitectos de software. Permite visualizar, analizar y auditar el grafo de dependencias de proyectos React/JS/TS con un diseño visual fluido de física interactiva, complementado con auditorías avanzadas de arquitectura, ciclos, impacto de cambios y complejidad de código.

---

## 🛠️ Características Clave e Implementaciones

### 1. Categorización Jerárquica y Reglas por Capas (Clean Architecture)
Agrupa y audita los archivos locales automáticamente en capas arquitectónicas definidas mediante el análisis de rutas y nomenclaturas de archivos:
*   **Dominio (`domain`)**: Modelos, interfaces y tipos de datos.
*   **Infraestructura (`data`)**: Servicios de API, utilidades generales y repositorios de datos.
*   **Aplicación (`hooks`)**: Custom Hooks que manejan lógica del lado de la UI.
*   **Negocio (`logic`)**: Estado global, contextos, stores de Redux y lógica de negocio central.
*   **Presentación (`presentation`)**: Vistas, componentes de UI y páginas.
*   **Recursos (`asset`)**: Estilos CSS, SVGs, imágenes y archivos de configuración JSON.

**Funcionalidades de Auditoría:**
*   **Agrupar por Capas (Clustering)**: Coloca magnéticamente los archivos en columnas verticales correspondientes a sus respectivas capas en orden de jerarquía lógica de izquierda a derecha.
*   **Auditoría de Infracción de Capas**: Dibuja en **línea discontinua roja animada** cualquier conexión que rompa la jerarquía (e.g. que una capa de *Dominio* intente importar algo de *Presentación*). El Inspector individual detalla la infracción.

---

### 2. Detección de Dependencias Circulares (Circular Dependencies)
Evita errores de referencia circular y fallas de renderizado de React en producción detectando bucles de importación cerrados (e.g., `A ➔ B ➔ C ➔ A`).
*   **Algoritmo DFS**: Realiza una búsqueda por profundidad con pila de recursión sobre el grafo de archivos locales en la carpeta `src/`.
*   **Filtro "Resaltar Ciclos"**: Atenúa el grafo completo al `0.1` de opacidad y hace brillar en **ámbar neón pulsante (`#ff9f1c`)** los nodos y enlaces que forman parte de dependencias circulares.
*   **Inspector Interactivo**: Al seleccionar un nodo cíclico, muestra la ruta detallada del bucle con enlaces interactivos. Al hacer clic en un paso de la ruta, el visor hace foco instantáneo en dicho archivo.

---

### 3. Análisis de Impacto de Cambios (Blast Radius)
Evalúa el impacto de propagación al modificar un archivo en la aplicación antes de realizar refactorizaciones o pull requests.
*   **Algoritmo BFS**: Trazado dinámico sobre el grafo inverso para hallar todas las dependencias transitivas (archivos que dependen directa o indirectamente del seleccionado).
*   **Visualización de Flujo**: Al presionar **"Ver Radio de Impacto"** en el inspector de un archivo local:
    *   El archivo origen se ilumina en **rojo carmesí brillante (`#d00000`)**.
    *   Todos los archivos afectados se iluminan en **ámbar**, atenuando el resto a opacidad `0.08`.
    *   Las líneas de flujo de importación se aceleran mediante una animación que simula la energía fluyendo de los componentes dependientes hacia la fuente.
*   **Tarjeta de Métricas**: Muestra el total y porcentaje de componentes locales de la app que se verían afectados por el cambio.
*   **Navegación Dinámica**: Permite hacer clic en archivos dentro del radio de impacto para auditar sus conexiones directas sin perder el contexto visual del análisis general.

---

### 4. Detección de Código Muerto (Dead Code / Archivos Huérfanos)
Localiza archivos locales olvidados que no están siendo importados por nadie dentro de la carpeta `src/`, optimizando el bundle y la limpieza del proyecto.
*   **Cálculo de Grado de Entrada (`in-degree`)**: Identifica archivos con 0 importaciones entrantes, excluyendo puntos de entrada estándar (`index`, `main` y `app` con extensiones de script).
*   **Filtro "Resaltar Código Muerto"**: Oculta conexiones y destaca en **gris oscuro con borde punteado amarillo** todos los archivos huérfanos.
*   **Reporte General de Limpieza**: Si no hay un nodo seleccionado, el inspector de nodo se convierte en una lista interactiva de todos los archivos huérfanos del proyecto. Al hacer clic en un elemento de la lista, el visor se enfoca directamente en él en el grafo.
*   **Alerta en Inspector**: Muestra la tarjeta amarilla `⚠️ Código Muerto / Archivo Huérfano` al seleccionar cualquiera de estos archivos.

---

### 5. Detección de Archivos Dios (God Files / Complejidad vs. Acoplamiento)
Identifica cuellos de botella de mantenimiento analizando módulos que concentran un nivel insostenible de lógica interna y dependencias directas.
*   **Métrica God Score**: Puntuación ponderada basada en el acoplamiento global del archivo (grado de entrada + grado de salida) multiplicado por su complejidad (líneas de código / 100):
    $$\text{God Score} = (\text{InDegree} + \text{OutDegree}) \times \frac{\text{LOC}}{100}$$
    Un archivo con un **God Score >= 50** califica como un **God File**.
*   **Filtro "Resaltar God Files"**: Destaca archivos sobredimensionados con un **borde grueso rojo pulsante y resplandor rojo carmesí**, atenuando los demás al `0.15`.
*   **Reporte General de God Files**: Lista todos los archivos locales ordenados de mayor a menor puntuación. Los archivos que superan el umbral de 50 aparecen con un fondo de alerta rojo.
*   **Recomendación de Refactorización**: El inspector de nodo muestra una advertencia detallando las LOC, conexiones y una sugerencia de dividir el archivo en submódulos o custom hooks independientes.

---

### 6. Visualización Enfocada en Archivo Activo (Active File Focus)
Vincula dinámicamente tu editor de código de VS Code con el grafo de dependencias, permitiéndote localizar de inmediato la estructura y relaciones del módulo que estás editando.
*   **Diálogo QuickPick**: Al presionar el botón de **"Grafo 📍"** en la barra del editor de un archivo `.js`/`.ts`/`.jsx`/`.tsx` activo, VS Code te desplegará un menú flotante para elegir si deseas abrir el grafo completo o inicializar la vista con el foco sobre el archivo activo.
*   **Autofoco y Centrado SVG**: Al seleccionar la apertura enfocada, el Webview seleccionará automáticamente el nodo inicial, desplegará su Inspector lateral con todas sus métricas y alertas, y realizará una **animación suave de cámara tridimensional (zoom y paneo a 1.2x)** centrando visualmente el nodo en la pantalla.

---

## 🚀 Cómo Usar la Extensión

1.  Abre un proyecto React/JS/TS en VS Code.
2.  Abre cualquier archivo de código (`.js`, `.jsx`, `.ts`, `.tsx`).
3.  En la barra de menú superior derecha del editor, haz clic en el icono **Grafo 📍** (o abre la paleta de comandos con `Ctrl + Shift + P` y ejecuta `Obsidian React: Grafo📍`).
4.  **Interacciones en el Grafo**:
    *   **Arrastrar**: Mueve nodos para inspeccionar visualmente su acoplamiento.
    *   **Click simple**: Abre el panel del inspector detallando dependencias entrantes, salientes, métricas de complejidad, tamaño, capas y alertas de problemas.
    *   **Doble click**: Abre físicamente el archivo en el editor de VS Code.
    *   **Scroll del mouse / Pellizcar**: Zoom in, zoom out y desplazamiento libre (pan).
    *   **Deslizadores de Fuerza**: Controla la repulsión y la distancia de los enlaces dinámicamente según la densidad del proyecto.
