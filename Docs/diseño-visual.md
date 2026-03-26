## 1. Identidad de Marca y Paleta de Colores
 
El diseño de la interfaz se basa estrictamente en la **paleta de colores institucional de Prontomatic**, garantizando coherencia visual con el logo corporativo y generando familiaridad inmediata en los agentes que ya conocen la marca.
 
### 1.1. Colores Base de la Marca
 
Extraídos del logo oficial de Prontomatic:
 
| Token de Diseño | Hex | RGB | Uso Principal |
|---|---|---|---|
| `--color-primary` | `#003F8A` | `rgb(0, 63, 138)` | Color dominante. Header, botones primarios, bordes activos, links y estados destacados. Es el azul oscuro institucional del logo. |
| `--color-primary-hover` | `#002F6C` | `rgb(0, 47, 108)` | Versión más oscura del primario. Estado `hover` de botones y elementos interactivos azules. |
| `--color-primary-light` | `#E8F0FB` | `rgb(232, 240, 251)` | Versión muy clara del azul. Fondo de badges de estado, highlights de filas seleccionadas. |
| `--color-accent` | `#FFD700` | `rgb(255, 215, 0)` | Amarillo institucional. Usado como acento, indicadores de alerta y badges de advertencia. Nunca como fondo de texto. |
| `--color-accent-dark` | `#E6C200` | `rgb(230, 194, 0)` | Versión más oscura del amarillo. Estado `hover` de elementos de acento. |
 
### 1.2. Colores de Interfaz (Sistema)
 
Colores neutros y funcionales que complementan la paleta institucional:
 
| Token de Diseño | Hex | Uso Principal |
|---|---|---|
| `--color-bg-app` | `#F4F7F9` | Fondo general de la aplicación. Gris muy suave que reduce la fatiga visual en sesiones largas de trabajo. |
| `--color-bg-card` | `#FFFFFF` | Fondo de tarjetas de ticket, paneles y contenedores de contenido. |
| `--color-bg-sidebar` | `#002F6C` | Fondo del sidebar de navegación. Versión oscura del primario para crear contraste y jerarquía visual. |
| `--color-text-primary` | `#1A1A2E` | Texto principal. Casi negro, más suave que el negro puro para reducir contraste excesivo. |
| `--color-text-secondary` | `#64748B` | Texto secundario, metadatos, timestamps, etiquetas de ayuda. |
| `--color-text-disabled` | `#A0AEC0` | Texto de elementos deshabilitados. |
| `--color-border` | `#E2E8F0` | Bordes de tarjetas, divisores y separadores. |
| `--color-border-focus` | `#003F8A` | Borde de elementos de formulario en estado de foco. |
 
### 1.3. Colores Semánticos de Estado
 
Cada estado del ticket tiene un color semántico asignado, coherente con las convenciones universales de sistemas de soporte:
 
| Estado del Ticket | Color de Fondo | Color de Texto | Hex Fondo | Uso |
|---|---|---|---|---|
| `ABIERTO` | Azul claro | Azul oscuro | `#DBEAFE` / `#1E40AF` | Badge de estado, cabecera de columna Kanban. |
| `EN_PROCESO_INTERNO` | Amarillo claro | Amarillo oscuro | `#FEF9C3` / `#854D0E` | Badge de estado, cabecera de columna Kanban. |
| `EN_ESPERA_CLIENTE` | Naranja claro | Naranja oscuro | `#FFEDD5` / `#9A3412` | Badge de estado, cabecera de columna Kanban. Alerta de tiempo activa. |
| `CERRADO` | Verde claro | Verde oscuro | `#DCFCE7` / `#166534` | Badge de estado, cabecera de columna Kanban. |
 
### 1.4. Colores de Alerta SLA
 
Indicadores visuales para el estado del contador de 48 horas:
 
| Tiempo restante | Color | Hex | Significado |
|---|---|---|---|
| Más de 24 horas | Verde | `#22C55E` | Sin riesgo de cierre automático. |
| Entre 12 y 24 horas | Amarillo | `#FFD700` | Advertencia. El ticket requiere atención pronto. |
| Menos de 12 horas | Rojo | `#EF4444` | Riesgo crítico de cierre automático inminente. |
| Tiempo agotado | Rojo parpadeante | `#DC2626` | El ticket está siendo cerrado por el sistema. |
 
---
 
## 2. Tipografía
 
### 2.1. Familia Tipográfica
 
ProntoTicket utiliza **Inter** como fuente principal en toda la interfaz.
 
**Justificación de la elección:**
Inter fue diseñada específicamente para interfaces de usuario digitales en pantalla. Sus características la hacen especialmente adecuada para un sistema de soporte de uso intensivo:
- Alta legibilidad a tamaños pequeños (10px–12px), frecuentes en dashboards con datos densos.
- Excelente distinción entre caracteres similares (`0` vs `O`, `l` vs `I` vs `1`), crítico para la lectura de RUTs y correos electrónicos.
- Integración nativa con el ecosistema de shadcn/ui, que es la librería de componentes del proyecto.
- Disponible gratuitamente en Google Fonts.
 
### 2.2. Escala Tipográfica
 
| Nombre | Tamaño | Peso | Uso |
|---|---|---|---|
| `display` | `24px / 1.5rem` | `700` (Bold) | Títulos de página principales (ej: "Dashboard de Tickets"). |
| `heading-1` | `20px / 1.25rem` | `600` (SemiBold) | Títulos de sección dentro de una página. |
| `heading-2` | `16px / 1rem` | `600` (SemiBold) | Subtítulos, nombres de tarjetas de ticket, asunto del ticket en la vista de detalle. |
| `body` | `14px / 0.875rem` | `400` (Regular) | Texto general, contenido de mensajes, descripciones. |
| `body-medium` | `14px / 0.875rem` | `500` (Medium) | Labels de formularios, nombres de agentes, datos del cliente. |
| `caption` | `12px / 0.75rem` | `400` (Regular) | Timestamps, metadatos secundarios, texto de ayuda. |
| `caption-bold` | `12px / 0.75rem` | `600` (SemiBold) | Badges de estado, contadores de columnas Kanban. |
 
### 2.3. Implementación en Tailwind CSS
 
```css
/* En tailwind.config.js */
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
 
/* En el layout raíz (layout.js) */
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
```
 
---
 
## 3. Estructura General del Layout
 
La aplicación utiliza un esquema de **pantalla completa de dos zonas**: una barra lateral fija de navegación (sidebar) y un área de contenido principal dinámica.
 
### 3.1. Sidebar de Navegación
 
**Dimensiones:** `240px` de ancho fijo en desktop. Colapsable a `64px` (solo íconos) en resoluciones menores o por preferencia del usuario.
 
**Color de fondo:** `#002F6C` (azul oscuro institucional).
 
**Elementos del sidebar por rol:**
 
| Ícono | Ítem | Visible para |
|---|---|---|
| 🎫 | Dashboard de Tickets | Agente, Supervisor, Admin |
| 📊 | Métricas y Desempeño | Supervisor, Admin |
| 👥 | Gestión de Usuarios | Admin |
| 🏷️ | Categorías | Admin |
| ⚙️ | Configuración | Admin |
 
**Indicador de rol:** En la parte inferior del sidebar se muestra el nombre completo del usuario autenticado, su correo y un badge de color con su rol:
- `AGENTE` → Badge gris claro
- `SUPERVISOR` → Badge azul claro
- `ADMINISTRADOR` → Badge amarillo (`#FFD700`)
 
**Ítem activo:** El ítem de navegación activo se resalta con fondo `#003F8A` y borde izquierdo de `3px` en color `#FFD700` (amarillo de acento institucional).
 
### 3.2. Header Superior
 
**Altura:** `56px` fijo.
 
**Color de fondo:** `#003F8A` (azul primario institucional).
 
**Contenido del header:**
- **Izquierda:** Logotipo de texto "ProntoTicket" en blanco con peso `700`. Subtexto "by Prontomatic" en amarillo `#FFD700` a `10px`.
- **Centro:** Barra de búsqueda global de tickets (busca por número de ticket, asunto o email del cliente).
- **Derecha:** Avatar del usuario con su nombre y un dropdown de sesión (Ver perfil / Cerrar sesión).
 
### 3.3. Área de Contenido Principal
 
Ocupa el espacio restante tras el sidebar (`calc(100vw - 240px)`). Tiene un padding interno de `24px` en todos los lados y un `overflow-y: auto` para permitir scroll independiente del sidebar.
 
---
 
## 4. Dashboard Principal — Vista Kanban
 
El dashboard es la pantalla central del sistema y organiza todos los tickets en columnas según su estado actual, siguiendo el patrón Kanban estándar de sistemas de soporte.
 
### 4.1. Barra de Controles del Dashboard
 
Ubicada en la parte superior del área de contenido, antes de las columnas Kanban:
 
```
[Filtrar por categoría ▼]  [Filtrar por agente ▼]  [Ordenar: Más reciente ▼]  [🔄 Actualizado hace 45s]
```
 
- **Filtro de categoría:** Dropdown con todas las categorías activas. Opción "Todas las categorías" por defecto.
- **Filtro de agente:** Solo visible para `SUPERVISOR` y `ADMINISTRADOR`. Dropdown con todos los agentes activos.
- **Selector de orden:** Permite ordenar las tarjetas dentro de cada columna por fecha de creación o por tiempo sin actividad.
- **Indicador de última actualización:** Muestra cuándo fue la última vez que el dashboard consultó nuevos datos (polling cada 60 segundos). Incluye botón manual de refresco.
 
### 4.2. Columnas Kanban
 
Se definen **cuatro columnas** alineadas con la máquina de estados del sistema, en orden de izquierda a derecha según el flujo natural del ciclo de vida de un ticket:
 
| # | Columna | Estado interno | Color de cabecera |
|---|---|---|---|
| 1 | **Abierto** | `ABIERTO` | Azul claro `#DBEAFE` con texto `#1E40AF` |
| 2 | **En proceso** | `EN_PROCESO_INTERNO` | Amarillo claro `#FEF9C3` con texto `#854D0E` |
| 3 | **Esperando cliente** | `EN_ESPERA_CLIENTE` | Naranja claro `#FFEDD5` con texto `#9A3412` |
| 4 | **Cerrado** | `CERRADO` | Verde claro `#DCFCE7` con texto `#166534` |
 
**Cabecera de columna:**
Cada columna tiene una cabecera que muestra el nombre del estado y un contador circular con el número de tickets en ese estado. Ejemplo: `Abierto (5)`.
 
**Ancho de columnas:** Las cuatro columnas dividen el área disponible en partes iguales (`25%` cada una), con `gap` de `16px` entre ellas.
 
**Scroll interno:** Cada columna tiene `overflow-y: auto` independiente, permitiendo hacer scroll dentro de una columna sin afectar a las demás.
 
### 4.3. Tarjeta de Ticket (Vista Previa en Kanban)
 
Cada ticket se representa como una tarjeta (`Card`) dentro de su columna correspondiente. La tarjeta está diseñada para mostrar la información crítica que el agente necesita para priorizar sin necesidad de abrir el detalle.
 
**Dimensiones:** Ancho completo de la columna. Alto variable según contenido, mínimo `120px`.
 
**Estructura visual de la tarjeta (de arriba hacia abajo):**
 
```
┌─────────────────────────────────────────┐
│ #142  Falla máquina piso 3              │  ← Número + Asunto (heading-2, truncado)
│                                         │
│ 📧 juan@cliente.cl                      │  ← Email del cliente (caption, gris)
│                                         │
│ 🪪 12.345.678-9   📍 Av. Siempreviva... │  ← RUT y Dirección (caption, si existen)
│                                         │
│ 🏷️ Falla de Maquinaria                  │  ← Categoría (badge pequeño)
│                                         │
│ 👤 María González        hace 2h  ⏱️ 11h│  ← Agente asignado + Tiempo creación + SLA
└─────────────────────────────────────────┘
```
 
**Detalle de cada elemento de la tarjeta:**
 
**Número y asunto:**
- El número de ticket (`#142`) se muestra en `caption-bold` con color `#003F8A`.
- El asunto se muestra en `heading-2` (`16px`, `600`) truncado a una línea con `text-overflow: ellipsis`.
 
**Email del cliente:**
- Ícono de sobre (📧) seguido del email en `caption` (`12px`) color `#64748B`.
 
**Datos enriquecidos (RUT y Dirección):**
- Solo se muestran si fueron encontrados en MySQL. Si no existen, la fila no aparece en la tarjeta.
- RUT precedido por ícono de cédula. Dirección precedida por ícono de ubicación.
- Texto en `caption` (`12px`) color `#64748B`.
- Si los datos no fueron encontrados, no se muestra nada (el aviso de "no encontrado" solo aparece en la vista de detalle).
 
**Badge de categoría:**
- Badge pequeño con fondo gris claro y texto en `caption-bold`. Solo se muestra si el ticket tiene categoría asignada.
 
**Pie de tarjeta:**
- **Agente asignado:** Avatar circular pequeño (24px) con las iniciales del agente y su nombre en `caption`. Si el ticket está en estado `ABIERTO` (sin asignar), se muestra "Sin asignar" en gris.
- **Tiempo transcurrido:** Tiempo relativo desde la creación del ticket (`hace 2h`, `hace 3 días`) en `caption` color `#64748B`.
- **Indicador SLA:** Solo visible en tickets con estado `EN_ESPERA_CLIENTE`. Muestra el tiempo restante antes del cierre automático con el color semántico correspondiente (verde / amarillo / rojo). Ejemplo: `⏱️ 11h`.
 
**Interacción:**
- Al hacer `hover` sobre la tarjeta, el borde izquierdo de la tarjeta cambia a `3px solid #003F8A` y el fondo pasa de `#FFFFFF` a `#F8FAFC`.
- Al hacer clic en cualquier parte de la tarjeta, se navega a la vista de detalle del ticket.
- El cursor es `pointer` en toda la superficie de la tarjeta.
 
**Tarjeta sin datos enriquecidos:**
Si el cliente no fue encontrado en MySQL, la tarjeta omite la fila de RUT y Dirección sin mostrar ningún aviso. El aviso detallado aparece únicamente en la vista de detalle.
 
---
 
## 5. Vista de Detalle del Ticket
 
Al hacer clic en una tarjeta del Kanban, el sistema navega a la vista de detalle del ticket (`/dashboard/tickets/[id]`). Esta vista ocupa el área de contenido completa y se divide en dos zonas: el **hilo de mensajes** (izquierda, zona principal) y el **panel lateral de información** (derecha, zona secundaria fija).
 
### 5.1. Cabecera del Ticket
 
Ocupa el ancho completo de la vista, con `padding: 16px 24px` y fondo blanco con borde inferior `1px solid #E2E8F0`.
 
**Elementos de la cabecera (de izquierda a derecha):**
 
```
← Volver al dashboard    #142 · Falla máquina dispensadora piso 3    [EN_PROCESO_INTERNO ▼]
                         📧 juan@cliente.cl · Creado 24/04/2024 11:32 · Por María González
```
 
- **Botón "← Volver":** Navega al dashboard. Texto `caption` en `#003F8A`.
- **Número y asunto:** `#142` en `caption-bold` azul + separador `·` + asunto completo en `heading-1`.
- **Badge de estado:** Dropdown interactivo en la esquina superior derecha que muestra el estado actual del ticket con su color semántico correspondiente. Al hacer clic, despliega las opciones de cambio de estado disponibles.
 
**Colores de badge de estado en la cabecera:**
 
| Estado | Fondo | Texto |
|---|---|---|
| `ABIERTO` | `#DBEAFE` | `#1E40AF` |
| `EN_PROCESO_INTERNO` | `#FEF9C3` | `#854D0E` |
| `EN_ESPERA_CLIENTE` | `#FFEDD5` | `#9A3412` |
| `CERRADO` | `#DCFCE7` | `#166534` |
 
- **Metadatos secundarios:** Email del cliente, fecha de creación y agente asignado en `caption` gris, en la segunda línea de la cabecera.
 
### 5.2. Layout de Dos Zonas
 
```
┌─────────────────────────────────┬──────────────────────┐
│                                 │                      │
│   HILO DE MENSAJES              │  PANEL LATERAL       │
│   (flex: 1, overflow-y: auto)   │  (280px fijo)        │
│                                 │                      │
│                                 │                      │
├─────────────────────────────────┤                      │
│   EDITOR DE RESPUESTA           │                      │
│   (altura fija en la base)      │                      │
└─────────────────────────────────┴──────────────────────┘
```
 
**Zona izquierda:** Ocupa el espacio restante (`flex: 1`). Contiene el hilo de mensajes en la parte superior (con scroll) y el editor de respuesta anclado en la parte inferior.
 
**Zona derecha:** `280px` de ancho fijo. Sin scroll independiente en desktop. Contiene el panel de información del cliente.
 
### 5.3. Hilo de Mensajería
 
El hilo muestra todos los mensajes del ticket en orden cronológico ascendente (el más antiguo arriba, el más reciente abajo), con scroll hasta el mensaje más reciente al cargar la vista.
 
**Diseño de burbujas de mensaje:**
 
Los mensajes del cliente y del agente se distinguen visualmente por su alineación y color:
 
**Mensaje del cliente (inbound — alineado a la izquierda):**
```
┌─────────────────────────────────────────────────┐
│  🧑 Cliente                    24/04 11:32       │
│ ┌───────────────────────────────────────────┐   │
│ │ Hola, tengo un problema con la máquina    │   │
│ │ del edificio Santa Clara 123. No funciona │   │
│ │ y muestra un error en la pantalla...      │   │
│ └───────────────────────────────────────────┘   │
│   Fondo: #F1F5F9  │  Borde: 1px #E2E8F0        │
└─────────────────────────────────────────────────┘
```
 
**Respuesta del agente (outbound — alineado a la derecha):**
```
┌─────────────────────────────────────────────────┐
│                   María González  24/04 14:15   │
│   ┌───────────────────────────────────────────┐ │
│   │ Estimado/a, junto con saludar y           │ │
│   │ solicitando las disculpas pertinentes...  │ │
│   └───────────────────────────────────────────┘ │
│        Fondo: #E8F0FB  │  Borde: 1px #C7D7F4   │
└─────────────────────────────────────────────────┘
```
 
**Especificaciones de las burbujas:**
 
| Elemento | Cliente (inbound) | Agente (outbound) |
|---|---|---|
| Alineación | Izquierda | Derecha |
| Color de fondo | `#F1F5F9` (gris muy claro) | `#E8F0FB` (azul muy claro) |
| Borde | `1px solid #E2E8F0` | `1px solid #C7D7F4` |
| Border radius | `0 12px 12px 12px` | `12px 0 12px 12px` |
| Padding | `12px 16px` | `12px 16px` |
| Ancho máximo | `75%` del ancho disponible | `75%` del ancho disponible |
| Nombre | "Cliente" en `caption-bold` gris | Nombre del agente en `caption-bold` azul |
| Timestamp | `caption` gris a la derecha del nombre | `caption` gris a la derecha del nombre |
 
**Renderizado de Markdown:**
El contenido de los mensajes se renderiza como Markdown. Elementos soportados: negritas (`**texto**`), cursivas, listas con viñetas, listas numeradas y bloques de código (`código`). Esto permite a los agentes formatear instrucciones técnicas de forma legible.
 
**Adjuntos en mensajes:**
Los archivos adjuntos se muestran debajo del texto del mensaje como miniaturas:
- **Imágenes:** Miniatura de `80px × 80px` con `border-radius: 8px`. Al hacer clic, se abre en un modal de visualización a tamaño completo.
- **PDFs y otros archivos:** Ícono de archivo con el nombre y tamaño del archivo. Botón de descarga al hacer clic.
- Todos los adjuntos generan un Signed URL temporal al hacer clic (válido 60 minutos).
 
### 5.4. Panel Lateral de Información del Cliente
 
Ubicado a la derecha del hilo. Fondo blanco `#FFFFFF`, borde izquierdo `1px solid #E2E8F0`, `padding: 20px`.
 
**Sección: Datos del Cliente**
 
```
DATOS DEL CLIENTE
─────────────────────────────
📧 Correo
   juan@cliente.cl
 
🪪 RUT
   12.345.678-9
 
📞 Teléfono
   +56 9 1234 5678
 
📍 Dirección
   Av. Siempreviva 742, Santiago
```
 
Cada campo se muestra con:
- Label en `caption` `#64748B` en mayúsculas pequeñas (ej: `CORREO`).
- Valor en `body-medium` `#1A1A2E`.
- Ícono representativo a la izquierda del label.
 
**Campos con datos faltantes:**
Si un campo no fue encontrado en MySQL, se muestra el label con el valor en texto rojo suave:
```
📞 TELÉFONO
   ⚠ Teléfono no encontrado
```
El texto de aviso se muestra en `#DC2626` (rojo) con peso `400`, tamaño `12px`.
 
**Nota de enriquecimiento completa:**
Si el campo `enrichment_note` del ticket no es `null`, se muestra un bloque de aviso adicional al final de la sección de datos:
 
```
┌─────────────────────────────────┐
│ ⚠ Aviso de enriquecimiento     │
│ Cliente no encontrado en la     │
│ base de datos. RUT, Teléfono y  │
│ Dirección no disponibles.       │
└─────────────────────────────────┘
```
Fondo `#FEF2F2`, borde `1px solid #FECACA`, texto `#DC2626`, `font-size: 12px`.
 
**Sección: Información del Ticket**
 
```
INFORMACIÓN DEL TICKET
─────────────────────────────
Ticket           #142
Creado           24/04/2024 11:32
Última actividad hace 2 horas
Estado           [EN PROCESO ▼]
Categoría        [Falla Maquinaria ▼]
Asignado a       María González
```
 
El estado y la categoría son **selectores interactivos** (dropdown inline) que permiten al agente o supervisor cambiar estos valores directamente desde el panel lateral sin necesidad de usar controles adicionales.
 
### 5.5. Editor de Respuesta (Outbound)
 
Anclado en la parte inferior de la zona izquierda. Fondo blanco con borde superior `1px solid #E2E8F0`. Altura base `180px`, expandible hacia arriba al escribir.
 
**Estructura del editor:**
 
```
┌────────────────────────────────────────────────────────────────┐
│ Redactar respuesta                                             │
│                                                                │
│  [Área de texto — placeholder: "Escribe tu respuesta aquí..."] │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ [Cambiar estado al enviar: Mantener en proceso ▼]  [Enviar →] │
└────────────────────────────────────────────────────────────────┘
```
 
**Área de texto:**
- `font-family: Inter`, `font-size: 14px`, `line-height: 1.6`.
- `border: 1px solid #E2E8F0`, `border-radius: 8px`, `padding: 12px`.
- En estado de foco: `border-color: #003F8A`, `box-shadow: 0 0 0 3px #E8F0FB`.
- Placeholder en `#A0AEC0`.
 
**Selector de estado al enviar:**
Dropdown que permite al agente definir el nuevo estado del ticket al mismo tiempo que envía la respuesta. Opciones:
- `Mantener en proceso` → ticket permanece `EN_PROCESO_INTERNO`
- `Esperar respuesta del cliente` → ticket pasa a `EN_ESPERA_CLIENTE`
- `Cerrar ticket` → ticket pasa a `CERRADO`
 
**Botón "Enviar correo electrónico":**
- Fondo: `#003F8A` (azul primario institucional).
- Texto: Blanco, `body-medium`, `font-size: 14px`.
- `border-radius: 8px`, `padding: 10px 24px`.
- Estado `hover`: Fondo `#002F6C`.
- Estado `disabled` (área de texto vacía): Fondo `#94A3B8`, cursor `not-allowed`.
- Alineado a la derecha del pie del editor.
 
**Acción de tomar ticket:**
Si el agente accede a un ticket en estado `ABIERTO` que aún no tiene asignado, en lugar del editor de respuesta se muestra un banner de acción:
 
```
┌─────────────────────────────────────────────────────────────────────┐
│  Este ticket aún no ha sido tomado.                                 │
│  ¿Deseas tomarlo y comenzar la gestión?         [Tomar ticket →]   │
└─────────────────────────────────────────────────────────────────────┘
```
Fondo `#E8F0FB`, borde `1px solid #C7D7F4`, botón en azul primario.
 
---
 
## 6. Vistas de Administración y Métricas
 
### 6.1. Panel de Métricas (Supervisor y Administrador)
 
Vista accesible desde el sidebar. Muestra tarjetas de métricas (`MetricCard`) organizadas en un grid.
 
**Grid de métricas globales (fila superior):**
 
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total tickets│ │ Tickets       │ │ Tiempo prom. │ │ Tasa cierre  │
│ este mes     │ │ abiertos hoy  │ │ resolución   │ │ automático   │
│              │ │               │ │              │ │              │
│     87       │ │      5        │ │   6.4h       │ │   12.5%      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```
 
Cada `MetricCard` tiene fondo blanco `#FFFFFF`, borde `1px solid #E2E8F0`, `border-radius: 12px`, `padding: 20px`. El número principal en `display` (`24px`, `700`) y la label en `caption` gris.
 
**Tabla de desempeño por agente (zona inferior):**
Tabla con columnas: Agente / Tickets tomados / Tickets cerrados / Tiempo prom. primera respuesta / Tiempo prom. resolución / Tickets cerrados automáticamente.
 
Filas alternadas en blanco y `#F8FAFC`. Cabecera de tabla en `#F1F5F9` con texto `caption-bold` `#64748B`. Valores numéricos alineados a la derecha.
 
### 6.2. Panel de Gestión de Usuarios (Administrador)
 
Vista de lista con un botón "+ Nuevo usuario" en la esquina superior derecha (fondo `#003F8A`, texto blanco).
 
Cada usuario se muestra en una fila con: Avatar inicial / Nombre completo / Correo / Rol (badge de color) / Estado activo (toggle switch) / Botón "Editar".
 
### 6.3. Panel de Gestión de Categorías (Administrador)
 
Vista de lista con botón "+ Nueva categoría". Cada categoría muestra: Nombre / Descripción / Estado activo (toggle switch) / Botón "Editar".
 
---
 
## 7. Sistema de Componentes UI (shadcn/ui + Tailwind CSS)
 
ProntoTicket utiliza **shadcn/ui** como librería de componentes base, personalizada con los tokens de diseño de Prontomatic definidos en la sección 1.
 
### 7.1. Configuración Base de shadcn/ui
 
```javascript
// components.json (shadcn/ui config)
{
  "style": "default",
  "rsc": true,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```
 
### 7.2. Catálogo de Componentes Utilizados
 
| Componente | shadcn/ui | Uso en ProntoTicket |
|---|---|---|
| `Button` | `Button` | Botones de acción (Enviar, Tomar ticket, Guardar). Variantes: `default` (azul), `outline`, `ghost`, `destructive`. |
| `Badge` | `Badge` | Estado del ticket, rol de usuario, categoría. |
| `Card` | `Card` | Tarjetas de ticket en el Kanban y en la vista de métricas. |
| `Dialog` | `Dialog` | Modales de confirmación para acciones críticas. |
| `Select` | `Select` | Dropdowns de filtrado y cambio de estado. |
| `Textarea` | `Textarea` | Editor de respuesta outbound. |
| `Toast` | `Sonner` | Notificaciones flotantes de nuevo ticket y acciones del sistema. |
| `Avatar` | `Avatar` | Foto/iniciales del agente en tarjetas y sidebar. |
| `Separator` | `Separator` | Divisores entre secciones del panel lateral. |
| `DropdownMenu` | `DropdownMenu` | Menú de usuario en el header (Ver perfil / Cerrar sesión). |
| `Tooltip` | `Tooltip` | Información adicional en íconos de la tarjeta de ticket (ej: tooltip del ícono de RUT). |
 
### 7.3. Especificación de Botones
 
| Variante | Uso | Fondo | Texto | Hover |
|---|---|---|---|---|
| `default` (primario) | Enviar respuesta, Tomar ticket, Guardar | `#003F8A` | `#FFFFFF` | `#002F6C` |
| `outline` | Cancelar, Volver, acciones secundarias | `transparent` | `#003F8A` | `#E8F0FB` |
| `ghost` | Acciones terciarias, navegación | `transparent` | `#64748B` | `#F1F5F9` |
| `destructive` | Desactivar usuario, acciones irreversibles | `#DC2626` | `#FFFFFF` | `#B91C1C` |
 
**Especificaciones generales de botones:**
- `border-radius: 8px`
- `padding: 10px 16px` para tamaño `default`
- `font-size: 14px`, `font-weight: 500`
- Transición `150ms ease` en cambios de color
 
### 7.4. Modales de Confirmación
 
Se utilizan para acciones críticas e irreversibles que requieren confirmación explícita del usuario:
 
**Acciones que requieren modal de confirmación:**
- Cerrar un ticket manualmente.
- Desactivar un usuario.
- Eliminar o desactivar una categoría.
 
**Estructura del modal:**
```
┌─────────────────────────────────────────┐
│  ¿Cerrar el ticket #142?                │
│                                         │
│  Esta acción marcará el caso como       │
│  resuelto y enviará la encuesta de      │
│  satisfacción al cliente.               │
│  Esta acción no puede deshacerse.       │
│                                         │
│              [Cancelar]  [Cerrar ticket]│
└─────────────────────────────────────────┘
```
- Ancho máximo: `440px`, centrado en pantalla.
- Overlay de fondo: `rgba(0, 0, 0, 0.5)`.
- Botón de confirmación: variante `destructive` o `default` según gravedad de la acción.
- Botón cancelar: variante `outline`.
 
---
 
## 8. Estados Visuales y Feedback al Usuario
 
### 8.1. Notificaciones Toast
 
Las notificaciones flotantes (`Toast`) aparecen en la **esquina superior derecha** de la pantalla con duración de **5 segundos** antes de desaparecer automáticamente.
 
| Evento | Tipo | Mensaje |
|---|---|---|
| Nuevo ticket recibido mientras el agente navega | Informativo (azul) | `"Nuevo ticket #143 recibido de juan@cliente.cl"` |
| Respuesta enviada exitosamente | Éxito (verde) | `"Respuesta enviada correctamente al cliente."` |
| Error al enviar respuesta | Error (rojo) | `"No se pudo enviar la respuesta. Intenta nuevamente."` |
| Ticket tomado exitosamente | Éxito (verde) | `"Has tomado el ticket #142."` |
| Ticket ya tomado por otro agente | Advertencia (amarillo) | `"El ticket #142 ya fue tomado por María González."` |
| Estado actualizado | Informativo (azul) | `"Estado actualizado a 'En espera de cliente'."` |
 
### 8.2. Estados de Carga
 
Durante la carga de datos (fetch inicial del dashboard, apertura de un ticket, envío de respuesta):
 
- **Skeleton loaders:** Las tarjetas del Kanban muestran un placeholder animado (`animate-pulse` de Tailwind) con las mismas dimensiones de una tarjeta real mientras cargan los datos. Evita el "salto" de layout al cargar.
- **Botón de envío:** Durante el envío de una respuesta, el botón "Enviar correo electrónico" muestra un spinner de carga y se deshabilita para prevenir envíos duplicados. Texto cambia a "Enviando...".
 
### 8.3. Estados Vacíos (Empty States)
 
Cuando una columna del Kanban no tiene tickets, muestra un estado vacío centrado dentro de la columna:
 
```
        📭
  Sin tickets aquí
```
 
Ícono a `32px`, texto en `caption` `#A0AEC0`. Fondo de la columna con patrón de puntos sutiles para indicar que el área está disponible.
 
---
 
## 9. Responsividad y Soporte de Dispositivos
 
ProntoTicket es una **aplicación de escritorio** pensada para ser utilizada en monitores de al menos `1280px` de ancho. Sin embargo, se implementan adaptaciones para resoluciones menores.
 
| Resolución | Comportamiento |
|---|---|
| `≥ 1280px` (desktop) | Layout completo. Sidebar de `240px` visible. 4 columnas Kanban en pantalla simultáneamente. Panel lateral de detalle de `280px` visible. |
| `1024px – 1279px` (laptop pequeño) | Sidebar colapsado a `64px` (solo íconos). Columnas Kanban con scroll horizontal. |
| `768px – 1023px` (tablet) | Sidebar colapsado a `64px`. Dashboard en vista de lista (tabla) en lugar de Kanban. Vista de detalle en pantalla completa sin panel lateral (datos del cliente se colapsan en un acordeón). |
| `< 768px` (móvil) | No optimizado para uso productivo. Se muestra un mensaje indicando que la aplicación está diseñada para uso en escritorio. |
 
---
 
## 10. Accesibilidad
 
Las siguientes prácticas de accesibilidad se aplican en toda la interfaz:
 
| Práctica | Implementación |
|---|---|
| **Contraste de color** | Todos los pares de color texto/fondo cumplen con el ratio mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande). El azul `#003F8A` sobre blanco cumple ampliamente. |
| **Navegación por teclado** | Todos los elementos interactivos (botones, dropdowns, inputs, tarjetas) son accesibles mediante `Tab` y activables con `Enter` o `Space`. |
| **Labels en formularios** | Todos los campos de formulario tienen `<label>` asociado o `aria-label` cuando el label visual no existe. |
| **Roles ARIA** | Las columnas Kanban tienen `role="region"` con `aria-label` descriptivo. Los badges de estado tienen `aria-label` con el nombre completo del estado. |
| **Mensajes de estado** | Los toasts y cambios de estado usan `aria-live="polite"` para ser anunciados por lectores de pantalla sin interrumpir el flujo del usuario. |
| **Indicador de foco visible** | Todos los elementos focusables muestran un anillo de foco visible: `outline: 2px solid #003F8A; outline-offset: 2px`. Nunca se usa `outline: none` sin un reemplazo visual. |
 
---
 
## 11. Mapa de Rutas del Frontend
 
ProntoTicket define las siguientes rutas de navegación dentro de la aplicación Next.js (App Router). Todas las rutas excepto `/login` requieren sesión activa; un usuario no autenticado es redirigido automáticamente a `/login`.
 
### 11.1. Tabla de Rutas
 
| Ruta | Archivo en `src/app/` | Acceso | Descripción |
|---|---|---|---|
| `/login` | `login/page.js` | Público | Pantalla de inicio de sesión. Formulario de email y contraseña. Redirige a `/dashboard` tras autenticación exitosa. |
| `/dashboard` | `dashboard/page.js` | Todos los roles | Dashboard principal con la vista Kanban de tickets. Punto de entrada tras el login. |
| `/dashboard/tickets/[id]` | `dashboard/tickets/[id]/page.js` | Todos los roles | Vista de detalle de un ticket específico. Incluye hilo de mensajes, panel de datos del cliente y editor de respuesta. |
| `/dashboard/metricas` | `dashboard/metricas/page.js` | Supervisor, Admin | Panel de métricas de desempeño del equipo. Incluye tarjetas de KPIs globales y tabla de desempeño por agente. |
| `/admin/usuarios` | `admin/usuarios/page.js` | Admin | Gestión de usuarios del sistema. Listado con opciones de crear, editar, activar y desactivar cuentas. |
| `/admin/usuarios/nuevo` | `admin/usuarios/nuevo/page.js` | Admin | Formulario de creación de nuevo usuario. Campos: nombre, email, rol, contraseña inicial. |
| `/admin/usuarios/[id]` | `admin/usuarios/[id]/page.js` | Admin | Formulario de edición de usuario existente. Permite modificar nombre, rol y estado activo. |
| `/admin/categorias` | `admin/categorias/page.js` | Admin | Gestión de categorías de tickets. Listado con opciones de crear, editar y desactivar. |
| `/admin/configuracion` | `admin/configuracion/page.js` | Admin | Parámetros generales del sistema. Incluye el umbral configurable de la notificación de cortesía (DP-03). |
 
### 11.2. Flujo de Autenticación y Primera Sesión
 
**Flujo de login:**
 
```
Usuario accede a cualquier ruta protegida
  └─► Middleware de Next.js detecta que no hay sesión activa
        └─► Redirige a /login
              └─► Usuario ingresa email y contraseña institucional
                    └─► Supabase Auth valida credenciales
                          ├─► Éxito → JWT almacenado en cookie HttpOnly
                          │           → Redirige a /dashboard
                          └─► Fallo  → Mensaje de error en pantalla
                                       → Permanece en /login
```
 
**Primera sesión de un usuario nuevo:**
Cuando el Administrador crea un nuevo usuario desde `/admin/usuarios/nuevo`, el sistema genera la cuenta en Supabase Auth con la contraseña inicial definida por el Administrador. En la primera sesión, el usuario no recibe ningún flujo de onboarding especial — accede directamente al dashboard con sus permisos de rol asignados. Se recomienda que el Administrador comunique la contraseña inicial al usuario por un canal seguro y que el usuario la cambie desde su perfil en la primera sesión.
 
**Recuperación de contraseña:**
Se delega completamente a Supabase Auth nativo. Supabase provee un flujo de recuperación por email de forma automática — no requiere desarrollo adicional en ProntoTicket. El enlace de recuperación enviado por Supabase redirige a la URL configurada en Supabase Auth → URL Configuration → Redirect URLs.
 
**Cierre de sesión:**
Disponible desde el dropdown de usuario en el header (cualquier pantalla). Invalida la sesión en Supabase Auth y elimina la cookie JWT. Redirige a `/login`.
 
### 11.3. Protección de Rutas por Rol
 
La protección de rutas se implementa en dos niveles:
 
**Nivel 1 — Middleware de Next.js (`middleware.js`):**
Verifica que exista una sesión activa antes de permitir el acceso a cualquier ruta protegida. Si no hay sesión, redirige a `/login`. Este middleware se ejecuta en el Edge Runtime de Vercel, antes de que la página se renderice.
 
**Nivel 2 — Verificación de rol en el componente de página:**
Cada página protegida por rol (`/dashboard/metricas`, `/admin/*`) verifica adicionalmente que el rol del usuario autenticado tenga permiso para acceder. Si el rol no es suficiente, redirige a `/dashboard` con un toast de error informando que no tiene permisos.
 
```
Agente intenta acceder a /admin/usuarios
  └─► Middleware: sesión activa ✅
        └─► Página verifica rol: AGENTE ≠ ADMINISTRADOR ❌
              └─► Redirige a /dashboard
                    └─► Toast: "No tienes permisos para acceder a esa sección."
```
 
### 11.4. Layout Compartido
 
Las rutas `/dashboard/*` y `/admin/*` comparten el layout principal (`layout.js`) que incluye el sidebar de navegación y el header. La ruta `/login` tiene su propio layout sin sidebar ni header, centrado en pantalla.
 
```
src/app/
├── layout.js                    ← Layout raíz (fuentes, metadata global)
├── login/
│   ├── layout.js                ← Layout de login (sin sidebar, centrado)
│   └── page.js
└── (protected)/                 ← Grupo de rutas protegidas (convención Next.js)
    ├── layout.js                ← Layout con sidebar + header (compartido)
    ├── dashboard/
    │   ├── page.js
    │   └── tickets/[id]/page.js
    ├── admin/
    │   ├── usuarios/...
    │   └── categorias/...
    └── ...
```
 