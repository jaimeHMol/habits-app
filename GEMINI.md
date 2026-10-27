# Contexto del Proyecto: Habits App

Eres un experto en ingeniería de software incluyendo UI and UX (Gemini) operando en la base de código de "Habits App". No le des automaticamente la razón al usuario, se crítico y has siempre las preguntas que consideres relevante. Todo el codigo que escribas, comentarios, variables, funciones, metodos, clases, etc deben estar en ingles. Debes basar todas tus respuestas de código, comandos y sugerencias arquitectónicas en las siguientes reglas y contexto.

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
- Todos los comentarios (incluyendo docstrings y comentarios inline en bloques de código sugeridos o documentación), nombres de variables, funciones, metodos, clases, constantes, etc. deben estar **estrictamente en inglés**, priorizando la buena legibilidad y fácil mantenimiento de la base de código.
- Siempre que agregues una nueva funcionalidad agrega los tests necesarios para asegurar la estabilidad y correcto funcionamiento de la aplicación a través del tiempo y la evolución del repo.
- Siempre que agregues una nueva funcionalidad o hagas un arreglo, asegurate ejecutar el lintern (ruff) y los tests del backend.
- En las decisiones de arquitectura, diseño e implementación, prioriza claridad y facilidad de mantenimiento, por sobre escalabilidad o soluciones bonitas o "over-enginered".

## 3. Convenciones de Código (Frontend)
- **Idioma del Código (Frontend y Backend):** Todo el código escrito o sugerido (comentarios inline, JSDoc, nombres de variables, funciones, métodos, componentes, hooks, clases, constantes, tests, etc.) debe estar **100% en inglés** sin excepción.
- **Case-Sensitivity Crítico:** Linux y Docker diferencian mayúsculas de minúsculas. Todo `import` en React debe coincidir LETRA POR LETRA con el nombre del archivo en el disco (ej. `import { InlineTaskForm } from './InlineTaskForm'`).
- Si Vite muestra errores de tipado estricto en producción, recuerda que el script de build en `package.json` está configurado para empaquetar con `vite build` saltando la verificación de `tsc`.
- Siempre que agregues una nueva funcionalidad agrega los tests necesarios para asegurar la estabilidad y correcto funcionamiento de la aplicación a través del tiempo y la evolución del repo.
- Siempre que agregues una nueva funcionalidad o hagas un arreglo, asegurate ejecutar el lintern (eslint) y los tests del frontend.
- Para diseño de la UI siempre prioriza la opción más clara, más limpia y consisa, buscando que la UX sea lo más intuitiva, sencilla y minimalista posible.
- Esta aplicación debe soportar las ultimas versiones de los navegadores Firefox y Chrome que se ejecutaran tanto en desktop (Windows y Macos) como en dispositivos moviles Android y Ios.
- **Internacionalización (i18n):** NUNCA escribas textos de interfaz (labels, botones, mensajes, placeholders) en código duro dentro de los componentes. SIEMPRE debes usar el sistema de traducciones existente. Para usarlo: (1) Añade la nueva llave de traducción tanto en `en` como en `es` dentro del archivo `frontend/src/i18n/translations.js`. (2) En el componente, obtén el idioma actual usando `const { language } = useHabitStore()`. (3) Importa el objeto de traducciones y resuélvelo usando `const t = translations[language] || translations.en`. (4) Usa el objeto `t` para renderizar los textos (ej. `t.mi_nueva_llave`).

## 4. Reglas de Infraestructura y Despliegue
- **Orquestación:** Nunca sugieras instalar dependencias globalmente en el servidor. Todo se maneja vía contenedores.
-  Este repo será deployado en un servidor Ubuntu 24.04 alojado en la nube.
- **Comando de actualización estándar:** `docker compose up -d --build <servicio>` (Se debe evitar usar `sudo` para prevenir que la ruta `~` se resuelva a `/root` en lugar del directorio del usuario actual).
- **Precaución con SQLite:** El archivo `backend/habits.db` está montado como un volumen. NUNCA sugieras borrar este archivo en producción ni montar un directorio en su lugar. Si la base de datos se corrompe o falta, debe inicializarse con el comando `touch habits.db` antes de levantar el contenedor de Python.

## 5. Formato de Respuestas
- Proporciona el código de forma modular.
- Siempre asegurate de que el pre-commit hook se ejecuta correctamente al hacer cambios, ya sea en el frontend, backend o la infraestructura.
- Si sugieres comandos de terminal, especifica si deben ejecutarse en la máquina local o en el servidor Ubuntu.
- Asume que los puertos de red (80, 443) ya están configurados y Caddy está deshabilitado en el servidor.

## 6. Principios y Reglas de UI/UX (Establecidos post-auditoría)
- **Local-First y UI Optimista:** Las interacciones del usuario (crear, completar, borrar tareas) deben reflejarse **inmediatamente** en la interfaz (0ms de latencia percibida) antes de esperar la respuesta del servidor. Usa encolado de acciones (Background Sync) para conexiones offline. El estado inicial debe cargarse desde el caché local (Zero-Loading-Screen).
- **Consistencia de Elementos e Íconos:** Mantén homogeneidad estricta geométrica y de peso visual. Íconos agrupados deben compartir el mismo tamaño y grosor de línea (ej. `size={16} strokeWidth={1.5}`). Prioriza formas básicas y angulares sobre diseños redondeados y complejos.
- **Evitar Controles Nativos del OS:** Nunca uses elementos nativos (como `<select>`) que rompan la inmersión del diseño oscuro ("dark/páramo"). Sustitúyelos por componentes personalizados (ej. `<Dropdown>`) hechos con Tailwind.
- **Copywriting de Interfaz (Puntuación):** Los textos cortos de la UI (etiquetas, estados vacíos, mensajes de error cortos, botones) **NUNCA deben llevar punto final**. Solo los párrafos largos y descriptivos llevan punto.
- **Microinteracciones ("Delight"):** Recompensa al usuario sutilmente al completar hábitos. Usa retroalimentación visual no bloqueante (como partículas de confeti respetando las preferencias de movimiento reducido) y auditiva sintetizada a través de la Web Audio API (tonos cálidos, octavas bajas, ondas suaves como 'sine' o 'triangle') en lugar de cargar pesados archivos mp3.
- **Empty States y Estados de Carga:** No dejes espacios en blanco "muertos". Usa "Empty States" iconográficos e inspiradores cuando no haya datos. Evita oscurecer (dimming) agresivamente los componentes durante estados de carga (`isSaving`); usa *spinners* localizados en los botones de acción para mantener la tarjeta viva.

## 7. Arquitectura y Reglas de Manejo de Fechas, Timers y Zonas Horarias (UTC + IANA Local)
Cualquier modelo o desarrollador que modifique lógica temporal (tareas, recordatorios, pomodoros, resets diarios/mensuales/anuales o analítica) **DEBE** seguir estrictamente estas reglas:

1. **Almacenamiento y Comparación de Instantes en UTC Puro (`timezone.utc`):**
   - Todos los campos `datetime` en el backend (`created_at`, `completed_at`, `started_at`, `interrupted_at`, `timer_end_time`, `last_triggered_at`) representan **instantes absolutos en UTC**.
   - Nunca uses `datetime.now()` ingenuo (*naive*) ni offsets fijos en código duro (como `timedelta(hours=-5)`). Usa siempre `datetime.now(timezone.utc)`.
   - **Normalización en SQLite (`sqlite_repository.py`):** Como SQLite no preserva metadatos de zona horaria nativamente y devuelve objetos `datetime` con `tzinfo=None`, todo repositorio que lea o escriba campos `datetime` debe pasar por los normalizadores (`_normalize_task_tz`, `_normalize_reminder_tz`, `_normalize_pomodoro_tz`). Estos convierten cualquier `datetime` con offset distinto a UTC mediante `.astimezone(timezone.utc)` antes de guardar y adjuntan `.replace(tzinfo=timezone.utc)` al leer desde SQLite.
   - **Serialización en Frontend (`parseServerDateMs`):** Al parsear timestamps ISO provenientes del backend en JavaScript, asegúrate de tratarlos como UTC (agregando `Z` si algún string carece de sufijo de zona horaria) antes de convertirlos a milisegundos epoch.

2. **Dimensiones de Calendario Local Dinámicas por Usuario (`user.timezone`):**
   - El modelo `User` almacena el identificador IANA de zona horaria en `user.timezone` (por defecto `"America/Bogota"`, validado mediante `normalize_timezone_name` y resuelto con `get_user_zone` en `backend/src/core/timezone.py` usando `zoneinfo.ZoneInfo`).
   - NUNCA asumas que el usuario está permanentemente en `America/Bogota`. Para determinar qué día es "hoy" (`YYYY-MM-DD`), la hora local del día (`0..23`), ventanas activas de notificaciones (`day_start_time` / `day_end_time`) o vencimientos de tareas mensuales/anuales, convierte siempre el instante UTC a la zona horaria del usuario: `now_local = now_utc.astimezone(get_user_zone(user.timezone))`.
   - **Auto-Sincronización al Viajar:** El frontend detecta automáticamente la zona horaria del navegador/OS mediante `Intl.DateTimeFormat().resolvedOptions().timeZone` al cargar el perfil (`fetchUserProfile` y `fetchReminders`). Si difiere de `user.timezone` (ej. el usuario viaja de Colombia `America/Bogota` a España `Europe/Madrid`), actualiza automáticamente el perfil en `PUT /users/settings`.

3. **Cambios de Día y Viajes entre Zonas Horarias (`checkDayChange`):**
   - La fecha de último reset (`last_period_reset_date` / `lastUsedDate`) se almacena en formato ISO `YYYY-MM-DD` (locale `'en-CA'`) evaluado en la zona horaria local actual del usuario (`getCurrentLocalDateStr()`).
   - **Comparación Estrictamente Hacia Adelante (`todayStr > lastUsedDate`):** Los resets diarios, mensuales y anuales solo deben dispararse cuando `todayStr > lastUsedDate` (y `todayYear > lastYear` o `todayMonth > lastMonth`). NUNCA uses `lastUsedDate !== todayStr`, ya que si un usuario viaja hacia el oeste cruzando la medianoche (ej. de España de regreso a Colombia cuando en España ya era el día siguiente pero en Colombia aún es el día anterior), una comparación con `!==` provocaría un doble reset regresivo.

4. **Timers Inmunes a Cambios de Huso Horario y Horario de Verano (DST):**
   - Tanto los Focus Timers de tareas como las sesiones de Pomodoro (`FOCUS` de 25m y `BREAK` de 5m) calculan su expiración usando tiempo epoch UTC (`Date.now()` en frontend y `datetime.now(timezone.utc) + timedelta(...)` en backend/APScheduler). Esto garantiza que un cronómetro en curso jamás se altere si el dispositivo cambia de zona horaria o entra/sale de horario de verano (DST).

5. **Arquitectura Same-Origin para API (`BASE_URL = ''`) y Aislamiento de Tests:**
   - El frontend usa rutas relativas (`BASE_URL = ''` en `frontend/src/services/api.js`), delegando el proxy a Vite en desarrollo (`frontend/vite.config.ts`) y a Nginx en producción (`nginx.conf`, incluyendo `/tasks/`, `/pomodoros/`, `/users/`, `/auth/`, `/push/`, `/reminders/`).
   - En los tests del backend (`backend/tests/conftest.py`), el `engine` de `src.infrastructure.database`, `src.main` y `src.application.reminder_scheduler` se sobreescribe en memoria (`sqlite:///:memory:` con `StaticPool`) antes de importar la app para garantizar que `pytest` jamás toque ni contamine `backend/data/habits.db`.
