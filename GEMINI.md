# Contexto del Proyecto: Habits App

Eres un experto en ingeniería de software (Gemini) operando en la base de código de "Habits App". Debes basar todas tus respuestas de código, comandos y sugerencias arquitectónicas en las siguientes reglas y contexto.

## 1. Stack Tecnológico Estricto
- **Frontend:** React, TypeScript, Vite. (Target de producción: `node:22-alpine`).
- **Backend:** Python con FastAPI.
- **Base de Datos:** SQLite gestionado a través de SQLModel.
- **Infraestructura:** Docker Compose (Frontend, Backend, Nginx como Reverse Proxy).

## 2. Convenciones de Arquitectura (Backend)
- Escribe código siguiendo los principios de la **Arquitectura Hexagonal** (Puertos y Adaptadores). 
- Mantén una estricta separación de responsabilidades: la lógica de negocio no debe acoplarse al framework web (FastAPI) ni a la base de datos (SQLModel).
- Aplica principios **SOLID** y diseño limpio basado en Programación Orientada a Objetos (OOP).
- Inyección de dependencias nativa de FastAPI para controladores.
- Todos los comentarios, nombres de variables, funciones, metodos, clases, etc deben estar en ingles, priorizando la buena legibilidad y fácil mantenimiento de la base de código.
- Siempre que agregues una nueva funcionalidad agrega los tests necesarios para asegurar la estabilidad y correcto funcionamiento de la aplicación a través del tiempo y la evolución del repo.
- Siempre que agregues una nueva funcionalidad o hagas un arreglo, asegurate ejecutar el lintern y los tests del backend.
- En las decisiones de arquitectura, diseño e implementación, prioriza claridad y facilidad de mantenimiento, por sobre escalabilidad o soluciones bonitas o "over-enginered".

## 3. Convenciones de Código (Frontend)
- **Case-Sensitivity Crítico:** Linux y Docker diferencian mayúsculas de minúsculas. Todo `import` en React debe coincidir LETRA POR LETRA con el nombre del archivo en el disco (ej. `import { InlineTaskForm } from './InlineTaskForm'`).
- Si Vite muestra errores de tipado estricto en producción, recuerda que el script de build en `package.json` está configurado para empaquetar con `vite build` saltando la verificación de `tsc`.
- Siempre que agregues una nueva funcionalidad agrega los tests necesarios para asegurar la estabilidad y correcto funcionamiento de la aplicación a través del tiempo y la evolución del repo.
- Siempre que agregues una nueva funcionalidad o hagas un arreglo, asegurate ejecutar el lintern y los tests del frontend.

## 4. Reglas de Infraestructura y Despliegue
- **Orquestación:** Nunca sugieras instalar dependencias globalmente en el servidor. Todo se maneja vía contenedores.
- **Comando de actualización estándar:** `sudo docker compose up -d --build <servicio>`
- **Precaución con SQLite:** El archivo `backend/habits.db` está montado como un volumen. NUNCA sugieras borrar este archivo en producción ni montar un directorio en su lugar. Si la base de datos se corrompe o falta, debe inicializarse con el comando `touch habits.db` antes de levantar el contenedor de Python.

## 5. Formato de Respuestas
- Proporciona el código de forma modular.
- Si sugieres comandos de terminal, especifica si deben ejecutarse en la máquina local o en el servidor Ubuntu.
- Asume que los puertos de red (80) ya están configurados y Caddy está deshabilitado en el servidor.