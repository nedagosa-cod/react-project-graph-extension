const fs = require('fs');
const path = require('path');
const { escanearDirectorio } = require('./file-system');
const { procesarGrafo } = require('./graph-builder');
const { procesarArchivoJS } = require('./scanner-js');
const { procesarArchivoPy } = require('./scanner-py');
const { evaluarVulnerabilidadesNPM } = require('./security-js');

function analizarTechStackJS(rutaProyecto, grafo) {
    let packageJsonPath = path.join(rutaProyecto, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        try {
            const items = fs.readdirSync(rutaProyecto);
            for (const item of items) {
                const subPath = path.join(rutaProyecto, item);
                if (fs.statSync(subPath).isDirectory() && !['node_modules', '.git', '.vscode', '.next', 'dist', 'build'].includes(item)) {
                    const candidate = path.join(subPath, 'package.json');
                    if (fs.existsSync(candidate)) {
                        packageJsonPath = candidate;
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
            
            if (deps['next']) grafo.techStack.framework = `Next.js (${deps['next']})`;
            else if (deps['react-native']) grafo.techStack.framework = `React Native (${deps['react-native']})`;
            else if (deps['vite']) grafo.techStack.framework = `Vite + React`;
            
            if (deps['zustand']) grafo.techStack.stateLocal = `Zustand (${deps['zustand']})`;
            else if (deps['@reduxjs/toolkit'] || deps['redux']) grafo.techStack.stateLocal = `Redux Toolkit / Redux`;
            else if (deps['jotai']) grafo.techStack.stateLocal = `Jotai (${deps['jotai']})`;
            else if (deps['recoil']) grafo.techStack.stateLocal = `Recoil (${deps['recoil']})`;
            else if (deps['mobx']) grafo.techStack.stateLocal = `MobX`;
            
            if (deps['@tanstack/react-query'] || deps['react-query']) grafo.techStack.stateServer = `TanStack Query (React Query)`;
            else if (deps['swr']) grafo.techStack.stateServer = `SWR (${deps['swr']})`;
            else if (deps['@apollo/client']) grafo.techStack.stateServer = `Apollo Client (GraphQL)`;
            else if (deps['axios']) grafo.techStack.stateServer = `Axios (${deps['axios']})`;
            
            if (deps['zod']) grafo.techStack.validation = `Zod (${deps['zod']})`;
            else if (deps['yup']) grafo.techStack.validation = `Yup (${deps['yup']})`;
            else if (deps['joi']) grafo.techStack.validation = `Joi`;
            else if (deps['typescript']) grafo.techStack.validation = `TypeScript (${deps['typescript']})`;
            
            const stylesList = [];
            if (deps['tailwindcss']) stylesList.push(`TailwindCSS (${deps['tailwindcss']})`);
            if (deps['styled-components']) stylesList.push(`Styled Components`);
            if (deps['@emotion/react']) stylesList.push(`Emotion`);
            if (deps['sass']) stylesList.push(`Sass`);
            if (stylesList.length > 0) grafo.techStack.styling = stylesList.join(', ');
            
            if (deps['react-hook-form']) grafo.techStack.forms = `React Hook Form (${deps['react-hook-form']})`;
            else if (deps['formik']) grafo.techStack.forms = `Formik`;
            
            const uiList = [];
            if (deps['@mui/material']) uiList.push('Material UI');
            if (deps['antd']) uiList.push('Ant Design');
            if (deps['@radix-ui/react-primitive'] || deps['@radix-ui/react-dialog']) uiList.push('Radix UI');
            if (deps['framer-motion']) uiList.push('Framer Motion');
            if (deps['lucide-react']) uiList.push('Lucide Icons');
            if (uiList.length > 0) grafo.techStack.uiComponents = uiList.join(', ');

            grafo.npmVulnerabilities = evaluarVulnerabilidadesNPM(deps);
        } catch (error) {
            console.log(`⚠️ No se pudo leer package.json: ${error.message}`);
        }
    }
}

function analizarTechStackPy(rutaProyecto, grafo) {
    let reqPath = path.join(rutaProyecto, 'requirements.txt');
    let tomlPath = path.join(rutaProyecto, 'pyproject.toml');
    
    // Si no existen en la raíz, buscar en directorios de primer nivel (para monorepos)
    if (!fs.existsSync(reqPath) && !fs.existsSync(tomlPath)) {
        try {
            const items = fs.readdirSync(rutaProyecto);
            for (const item of items) {
                const subPath = path.join(rutaProyecto, item);
                if (fs.statSync(subPath).isDirectory() && !['node_modules', '.git', '.vscode', '.next', 'dist', 'build', '.venv', 'venv'].includes(item)) {
                    const candidateReq = path.join(subPath, 'requirements.txt');
                    const candidateToml = path.join(subPath, 'pyproject.toml');
                    if (fs.existsSync(candidateReq)) {
                        reqPath = candidateReq;
                        break;
                    } else if (fs.existsSync(candidateToml)) {
                        tomlPath = candidateToml;
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    let content = '';
    if (fs.existsSync(reqPath)) {
        content = fs.readFileSync(reqPath, 'utf8');
    } else if (fs.existsSync(tomlPath)) {
        content = fs.readFileSync(tomlPath, 'utf8');
    }

    if (content) {
        // Framework / Core
        if (content.includes('Django') || content.includes('django')) grafo.techStack.framework = 'Django';
        else if (content.includes('fastapi')) grafo.techStack.framework = 'FastAPI';
        else if (content.includes('Flask') || content.includes('flask')) grafo.techStack.framework = 'Flask';

        // ORM / Database
        if (content.includes('SQLAlchemy') || content.includes('sqlalchemy')) grafo.techStack.orm = 'SQLAlchemy';
        else if (content.includes('Django') || content.includes('django')) grafo.techStack.orm = 'Django ORM';
        else if (content.includes('supabase')) grafo.techStack.orm = 'Supabase / PostgREST';
        else if (content.includes('pymongo')) grafo.techStack.orm = 'PyMongo (MongoDB)';
        else if (content.includes('psycopg2') || content.includes('asyncpg')) grafo.techStack.orm = 'PostgreSQL (Driver nativo)';

        // Validation / Schemas
        if (content.includes('pydantic')) grafo.techStack.validation = 'Pydantic';
        else if (content.includes('marshmallow')) grafo.techStack.validation = 'Marshmallow';

        // Background Tasks / Message Brokers
        if (content.includes('celery')) grafo.techStack.backgroundTasks = 'Celery';
        else if (content.includes('rq')) grafo.techStack.backgroundTasks = 'RQ';
        else if (content.includes('pika') || content.includes('aio-pika')) grafo.techStack.backgroundTasks = 'RabbitMQ (Pika)';
        else if (content.includes('kafka')) grafo.techStack.backgroundTasks = 'Apache Kafka';

        // Cache
        if (content.includes('redis')) grafo.techStack.cache = 'Redis';
        else if (content.includes('memcached')) grafo.techStack.cache = 'Memcached';

        // Migrations
        if (content.includes('alembic')) grafo.techStack.migrations = 'Alembic';
        else if (content.includes('Django') || content.includes('django')) grafo.techStack.migrations = 'Django Migrations';
    }
}

function obtenerGrafo(rutaProyecto, tipoEntorno = 'frontend') {
    const grafo = {
        nodes: [],
        links: [],
        tipoEntorno: tipoEntorno,
        npmVulnerabilities: [],
        techStack: {
            framework: tipoEntorno === 'frontend' ? 'React (Cliente)' : 'Python (General)',
            stateLocal: tipoEntorno === 'frontend' ? 'React State / Context' : 'N/A',
            stateServer: tipoEntorno === 'frontend' ? 'Fetch API / Nativo' : 'N/A',
            validation: 'Ninguno',
            styling: tipoEntorno === 'frontend' ? 'CSS nativo' : 'N/A',
            forms: tipoEntorno === 'frontend' ? 'Formularios nativos' : 'N/A',
            uiComponents: tipoEntorno === 'frontend' ? 'Ninguno' : 'N/A',
            orm: tipoEntorno === 'backend' ? 'N/A' : undefined,
            backgroundTasks: tipoEntorno === 'backend' ? 'Ninguna' : undefined
        }
    };

    const excluidosGlobales = ['node_modules', '.git', '.next', 'dist', 'build', 'out', '.vscode', '.idea', 'public', '.agents', '.gemini', '.venv', 'venv', 'env', '__pycache__'];
    
    if (tipoEntorno === 'frontend') {
        analizarTechStackJS(rutaProyecto, grafo);

        let startDir = path.join(rutaProyecto, 'src');
        let isRootScan = false;

        if (!fs.existsSync(startDir)) {
            startDir = rutaProyecto;
            isRootScan = true;
        }

        escanearDirectorio(startDir, excluidosGlobales, (rutaArchivo, tamañoArchivo, archivo, directorio) => {
            if (archivo.endsWith('.js') || archivo.endsWith('.jsx') || archivo.endsWith('.ts') || archivo.endsWith('.tsx')) {
                if (isRootScan && directorio === rutaProyecto) {
                    if (archivo.includes('.config.') || archivo === 'eslint.config.js') {
                        return;
                    }
                }
                procesarArchivoJS(rutaProyecto, rutaArchivo, tamañoArchivo, grafo, isRootScan);
            }
        });

    } else if (tipoEntorno === 'backend') {
        analizarTechStackPy(rutaProyecto, grafo);

        let startDir = rutaProyecto;
        let isRootScan = true;

        escanearDirectorio(startDir, excluidosGlobales, (rutaArchivo, tamañoArchivo, archivo, directorio) => {
            if (archivo.endsWith('.py')) {
                procesarArchivoPy(rutaProyecto, rutaArchivo, tamañoArchivo, grafo, isRootScan);
            }
        });
    }

    return procesarGrafo(grafo);
}

module.exports = { obtenerGrafo };
