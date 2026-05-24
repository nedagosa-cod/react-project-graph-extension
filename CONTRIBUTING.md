# Contribuyendo a React Project Graph 🚀

¡Primero que nada, gracias por tomarte el tiempo de contribuir! Este proyecto está hecho para arquitectos y líderes técnicos de React y Next.js, y las ideas, sugerencias y correcciones de la comunidad son lo que lo hace crecer.

A continuación, encontrarás una guía rápida para levantar el entorno de desarrollo y enviar tus contribuciones.

---

## 🛠️ Requisitos Previos

Necesitas tener instalado:
*   [Node.js](https://nodejs.org/) (versión 16 o superior).
*   [pnpm](https://pnpm.io/) (nuestro gestor de paquetes de preferencia).
*   [VS Code](https://code.visualstudio.com/) (para debugear y correr el host de desarrollo de extensiones).

---

## 💻 Levantando el Proyecto Localmente

Sigue estos pasos para clonar y empezar a editar la extensión:

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/nedagosa-cod/react-project-graph-extension.git
    cd react-project-graph-extension
    ```
2.  **Instalar las dependencias**:
    ```bash
    pnpm install
    ```
3.  **Correr la extensión en modo de pruebas (Debugging)**:
    *   Abre la carpeta del proyecto en VS Code (`code .`).
    *   Presiona la tecla **`F5`** (o ve a la pestaña de Run & Debug a la izquierda y presiona **"Run Extension"**).
    *   Esto abrirá una nueva ventana de VS Code llamada `[Extension Development Host]` (Anfitrión de desarrollo de extensiones).
    *   En esa nueva ventana, abre cualquier proyecto de React/Next.js y abre un archivo `.js`/`.tsx` para probar el grafo.

---

## 📂 Estructura del Proyecto

*   **`extension.js`**: El núcleo de la extensión en VS Code. Administra los comandos, el menú QuickPick, la creación del Webview y el envío de mensajes.
*   **`src/scanner.js`**: El escáner estático autónomo de código en JavaScript. Analiza los imports, detecta secretos hardcodeados, dependencias circulares, God Files y vulnerabilidades de `package.json`.
*   **`src/webview/`**: Todo el frontend interactivo del Webview.
    *   `view.html`: La maquetación y estructura HTML de la leyenda, los filtros y el inspector lateral.
    *   `styles.css`: Estilos visuales Obsidian Dark, scrollbars premium y animaciones neón de pulso.
    *   `app.js`: El motor interactivo que renderiza el grafo tridimensional de D3, maneja la física de fuerzas, el Blast Radius y los filtros interactivos.

---

## 📮 Enviando un Pull Request (PR)

1.  Crea una rama descriptiva para tu cambio:
    ```bash
    git checkout -b feature/mi-nueva-caracteristica
    # o para correcciones
    git checkout -b fix/corregir-bug-x
    ```
2.  Realiza tus cambios en el código y pruébalos exhaustivamente.
3.  Si haces cambios en el Webview o el Escáner, puedes probarlos directamente recargando la ventana de pruebas (`Ctrl+R` dentro de la ventana de desarrollo de la extensión).
4.  Haz commit de tus cambios utilizando mensajes claros y descriptivos en español:
    ```bash
    git commit -m "feat: agregar soporte para visualización de componentes en Astro"
    ```
5.  Haz push a tu rama:
    ```bash
    git push origin feature/mi-nueva-caracteristica
    ```
6.  Abre un **Pull Request** en GitHub y describe detalladamente tus cambios, qué bug soluciona o qué funcionalidad agrega, incluyendo capturas de pantalla si modificaste la UI.

¡Muchísimas gracias por colaborar! Tu aporte ayuda a que los líderes técnicos mantengan sus arquitecturas limpias y seguras.
