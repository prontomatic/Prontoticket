# Guía de Instalación, Configuración y Despliegue — ProntoTicket

## 1. Requisitos Previos

Antes de comenzar con la instalación y configuración de ProntoTicket, asegúrese de contar con todos los elementos listados a continuación. La ausencia de cualquiera de estos impedirá el correcto funcionamiento del sistema.

### 1.1. Software Local

| Herramienta | Versión mínima | Verificación | Notas |
|---|---|---|---|
| **Node.js** | `18.x` o superior | `node --version` | Next.js App Router requiere Node.js 18 como mínimo. Se recomienda usar la última versión LTS disponible. |
| **npm** | `9.x` o superior | `npm --version` | Incluido con Node.js. Gestor de paquetes del proyecto. |
| **Git** | `2.x` o superior | `git --version` | Requerido para clonar el repositorio y para el flujo CI/CD con Vercel. |

> **Recomendación:** Se sugiere usar [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) para gestionar la versión de Node.js, especialmente si se trabaja con múltiples proyectos. Esto permite cambiar de versión fácilmente sin afectar otros proyectos del sistema.

### 1.2. Cuentas y Accesos Requeridos

Las siguientes cuentas deben estar activas y configuradas antes de iniciar el desarrollo. Son las plataformas que componen la infraestructura del sistema:

| Plataforma | Propósito en ProntoTicket | URL |
|---|---|---|
| **Supabase** | Base de datos PostgreSQL principal, autenticación de usuarios (Supabase Auth) y almacenamiento de adjuntos (Supabase Storage). | [supabase.com](https://supabase.com) |
| **SendGrid** | Recepción de correos entrantes (Inbound Parse Webhook) y envío de respuestas y notificaciones automáticas (Mail Send API). | [sendgrid.com](https://sendgrid.com) |
| **Vercel** | Plataforma de hosting, ejecución de funciones serverless (API Routes) y programación de tareas automáticas (Cron Jobs). | [vercel.com](https://vercel.com) |
| **GitHub** | Alojamiento del repositorio del proyecto e integración con Vercel para despliegue continuo. | [github.com](https://github.com) |

### 1.3. Acceso a Base de Datos Legacy

Se requiere acceso de **solo lectura** a la base de datos MySQL preexistente de Prontomatic para el proceso de enriquecimiento automático de datos de clientes. Esto implica contar con:

- Host o dirección IP del servidor MySQL.
- Puerto de conexión (por defecto `3306`).
- Nombre de la base de datos.
- Usuario con permisos exclusivamente de `SELECT`.
- Contraseña del usuario.

> **Importante:** ProntoTicket nunca escribe en la base de datos MySQL de Prontomatic. El acceso debe configurarse con permisos de solo lectura como medida de seguridad. Si no se tiene certeza sobre la ubicación del servidor MySQL (local u hosting externo), contactar al equipo de infraestructura de Prontomatic antes de continuar.

---

## 2. Configuración del Entorno Local

### 2.1. Clonación del Repositorio

```bash
# Clonar el repositorio desde GitHub
git clone https://github.com/prontomatic/Prontoticket.git

# Acceder al directorio del proyecto
cd Prontoticket
```

Una vez clonado, se tendrán las tres ramas del flujo de trabajo disponibles localmente. La rama activa por defecto será `main`. Para comenzar a desarrollar, cambiar a la rama `dev`:

```bash
# Cambiar a la rama de desarrollo activo
git checkout dev
```

### 2.2. Instalación de Dependencias

```bash
# Instalar todas las dependencias del proyecto
npm install
```

Este comando instala todos los paquetes definidos en `package.json`, incluyendo Next.js, Prisma, el SDK de Supabase, el SDK de SendGrid, Zod, shadcn/ui y sus dependencias.

> **Nota:** Si durante la instalación aparece algún warning de compatibilidad de versiones entre paquetes, verificar que la versión de Node.js instalada cumple con el requisito mínimo (`node --version` debe retornar `v18.x.x` o superior).

### 2.3. Configuración de Variables de Entorno Locales

Crear un archivo `.env.local` en la **raíz del proyecto** (al mismo nivel que `package.json`) con el siguiente contenido. Este archivo **nunca debe commitearse al repositorio** — está excluido por defecto en el `.gitignore` del proyecto.

```bash
# ─── Base de Datos Principal (PostgreSQL - Supabase) ─────────────────────────
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# ─── Base de Datos Legacy (MySQL - Prontomatic) ───────────────────────────────
# Reemplazar con las credenciales reales provistas por el equipo de Prontomatic
LEGACY_DATABASE_URL="mysql://[USUARIO]:[PASSWORD]@[HOST]:[PUERTO]/[NOMBRE_DB]"

# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# ─── SendGrid ─────────────────────────────────────────────────────────────────
SENDGRID_API_KEY="SG.[API_KEY]"
SENDGRID_WEBHOOK_VERIFICATION_KEY="[PUBLIC_KEY_ECDSA]"

# ─── Vercel Cron Jobs ─────────────────────────────────────────────────────────
CRON_SECRET="[CADENA_ALEATORIA_SEGURA]"

# ─── Aplicación ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Dónde obtener cada valor:**

| Variable | Dónde encontrarla |
|---|---|
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → Connection string → URI |
| `LEGACY_DATABASE_URL` | Provista por el equipo de infraestructura de Prontomatic |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` `secret` key |
| `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → API Keys → Create API Key |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | SendGrid Dashboard → Settings → Inbound Parse → Security Policy → Public Key |
| `CRON_SECRET` | Generar manualmente con: `openssl rand -base64 32` |

### 2.4. Generación del Cliente Prisma

Prisma requiere generar su cliente antes de poder usarse. Este paso debe ejecutarse cada vez que se modifique el archivo `schema.prisma`:

```bash
# Generar el cliente de Prisma para ambas bases de datos
npx prisma generate
```

Este comando lee el `schema.prisma` y genera el cliente tipado de Prisma en `node_modules/@prisma/client`. Sin este paso, el servidor no puede comunicarse con las bases de datos.

### 2.5. Sincronización del Esquema con Supabase

Para crear las tablas definidas en `schema.prisma` en la base de datos PostgreSQL de Supabase:

```bash
# Aplicar el esquema a la base de datos (solo PostgreSQL)
npx prisma db push
```

> **Diferencia entre `db push` y `migrate`:** `prisma db push` aplica los cambios del esquema directamente sin generar archivos de migración. Es el método recomendado durante la fase de desarrollo inicial cuando el esquema aún está evolucionando. Una vez que el esquema se estabilice en producción, se recomienda migrar al flujo de `prisma migrate` para tener un historial de migraciones controlado.

> **Importante:** `prisma db push` solo aplica sobre la base de datos PostgreSQL (Supabase). La base de datos MySQL de Prontomatic es de solo lectura y nunca recibe migraciones desde ProntoTicket.

### 2.6. Ejecución del Servidor de Desarrollo

```bash
# Iniciar el servidor de desarrollo de Next.js
npm run dev
```

El servidor estará disponible en `http://localhost:3000`. Next.js habilitará Hot Module Replacement (HMR), lo que significa que los cambios en el código se reflejan en el navegador automáticamente sin reiniciar el servidor.

---

## 3. Configuración de Servicios Externos

Esta sección detalla los pasos de configuración en cada plataforma externa que requieren acción manual antes de que el sistema pueda funcionar correctamente.

### 3.1. Supabase

#### 3.1.1. Creación del Proyecto

1. Acceder a [supabase.com](https://supabase.com) e iniciar sesión.
2. Crear un nuevo proyecto. Seleccionar la región más cercana a Chile: **South America (São Paulo)** o **US East (N. Virginia)** como alternativa.
3. Definir una contraseña segura para la base de datos y guardarla en un gestor de contraseñas. Esta contraseña forma parte del `DATABASE_URL`.

#### 3.1.2. Configuración de Supabase Auth

Supabase Auth gestiona el login de agentes, supervisores y administradores. No se requiere configuración adicional de proveedores OAuth — solo se usa autenticación por email y contraseña.

1. En el Dashboard de Supabase → Authentication → Providers, verificar que **Email** esté habilitado.
2. Deshabilitar **"Enable email confirmations"** si se desea que las cuentas creadas por el Administrador sean activadas inmediatamente sin requerir confirmación de correo. Esto es recomendable para un sistema de uso interno.
3. En Authentication → URL Configuration, configurar la **Site URL** con la URL de producción: `https://ticketera.prontomatic.cl`.

#### 3.1.3. Configuración de Supabase Storage

1. En el Dashboard de Supabase → Storage, crear un nuevo bucket llamado `adjuntos`.
2. Configurar el bucket como **privado** (desactivar "Public bucket").
3. Verificar que las políticas de acceso (RLS Policies) estén configuradas para que solo usuarios autenticados con sesión activa puedan generar Signed URLs. La política de acceso se define a través del service role key desde el servidor.

### 3.2. SendGrid

#### 3.2.1. Configuración del Dominio de Envío

1. En SendGrid Dashboard → Settings → Sender Authentication, autenticar el dominio `prontomatic.cl`.
2. Seguir el proceso de verificación DNS que SendGrid indica (agregar registros CNAME en el proveedor DNS del dominio).
3. Una vez verificado, todos los correos enviados desde `contacto@prontomatic.cl` pasarán las validaciones SPF y DKIM, mejorando la entregabilidad.

#### 3.2.2. Configuración de Inbound Parse (Webhook Entrante)

1. En SendGrid Dashboard → Settings → Inbound Parse, hacer clic en **"Add Host & URL"**.
2. Configurar los campos:
   - **Receiving Domain:** `prontomatic.cl`
   - **Destination URL:** `https://ticketera.prontomatic.cl/api/webhook/ingesta`
   - Activar **"Check incoming emails for spam"** para filtrar spam automáticamente.
3. Configurar los registros MX del dominio `prontomatic.cl` para que apunten a los servidores de SendGrid (`mx.sendgrid.net`). Este paso debe coordinarse con el equipo que administra el DNS del dominio.

> ⚠️ **Advertencia crítica:** Al configurar los registros MX para que apunten a SendGrid, **todos** los correos entrantes al dominio serán procesados por SendGrid y enviados al webhook. Si existen otras casillas de correo en el dominio (`@prontomatic.cl`) que deben seguir funcionando normalmente, se debe configurar el Inbound Parse solo para el subdominio `parse.prontomatic.cl` en lugar del dominio raíz, y usar la dirección `contacto@parse.prontomatic.cl` para el buzón de soporte. Coordinar este punto con el equipo de infraestructura de Prontomatic antes de ejecutar el cambio.

#### 3.2.3. Configuración de la Firma ECDSA del Webhook

1. En SendGrid Dashboard → Settings → Inbound Parse → (editar la configuración creada) → Security Policy.
2. Activar **"Signature Verification"**.
3. SendGrid generará un par de claves pública/privada. Copiar la **clave pública** y guardarla como valor de la variable `SENDGRID_WEBHOOK_VERIFICATION_KEY`.

#### 3.2.4. Creación de la API Key de Envío

1. En SendGrid Dashboard → Settings → API Keys → Create API Key.
2. Seleccionar **"Restricted Access"** y otorgar únicamente el permiso **"Mail Send"** (no dar acceso completo a la cuenta).
3. Copiar la API Key generada y guardarla como valor de `SENDGRID_API_KEY`.

> La API Key solo se muestra una vez al momento de su creación. Si se pierde, debe generarse una nueva.

---

## 4. Configuración de Despliegue en Vercel

### 4.1. Conexión del Repositorio

1. Acceder a [vercel.com](https://vercel.com) e iniciar sesión.
2. Hacer clic en **"Add New Project"**.
3. Importar el repositorio `prontomatic/Prontoticket` desde GitHub. Si no aparece en la lista, autorizar a Vercel el acceso al repositorio desde la configuración de la cuenta GitHub.
4. En la pantalla de configuración del proyecto:
   - **Framework Preset:** Next.js (Vercel lo detecta automáticamente).
   - **Root Directory:** `.` (raíz del repositorio).
   - **Build Command:** `npm run build` (valor por defecto de Next.js).
   - **Output Directory:** `.next` (valor por defecto de Next.js).
5. Antes de hacer el primer despliegue, configurar las variables de entorno (sección 4.2).

### 4.2. Variables de Entorno en Vercel

En la pantalla de configuración del proyecto → **Environment Variables**, cargar todas las variables requeridas. Vercel permite especificar en qué entornos aplica cada variable (Production, Preview, Development).

La siguiente tabla define la configuración recomendada:

| Variable | Production | Preview | Development | Notas |
|---|:---:|:---:|:---:|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | Puede apuntar a instancias de Supabase distintas por entorno para mayor aislamiento. |
| `LEGACY_DATABASE_URL` | ✅ | ⚠️ | ❌ | En Preview, evaluar si conectar a la base MySQL real o a una copia de prueba. En Development, usar `.env.local`. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | Nunca con prefijo `NEXT_PUBLIC_`. Solo accesible desde el servidor. |
| `SENDGRID_API_KEY` | ✅ | ⚠️ | ❌ | En Preview, usar con precaución — puede enviar correos reales a clientes si se procesa un correo entrante real. En Development, usar `.env.local`. |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | ✅ | ✅ | ✅ | |
| `CRON_SECRET` | ✅ | ✅ | ❌ | Solo necesario en entornos donde el Cron Job está activo. En Development, usar `.env.local`. |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | ✅ | Valor diferente por entorno. En Production: `https://ticketera.prontomatic.cl`. En Preview: URL generada por Vercel. |

### 4.3. Configuración del Dominio Personalizado

Para que el sistema sea accesible en `ticketera.prontomatic.cl`:

1. En el Dashboard de Vercel → proyecto ProntoTicket → **Settings → Domains**.
2. Agregar el dominio `ticketera.prontomatic.cl`.
3. Vercel indicará los registros DNS que deben agregarse en el proveedor del dominio `prontomatic.cl` (generalmente un registro CNAME apuntando a `cname.vercel-dns.com`).
4. Coordinar con el equipo que administra el DNS de Prontomatic para agregar el registro.
5. Vercel emitirá automáticamente un certificado SSL/TLS para el dominio una vez que el registro DNS se propague (puede tardar hasta 48 horas).

### 4.4. Configuración del Vercel Cron Job

Para habilitar el job de cierre automático de tickets por inactividad de 48 horas, crear el archivo `vercel.json` en la **raíz del proyecto** con el siguiente contenido:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactivity",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Parámetros del cron job:**

| Parámetro | Valor | Descripción |
|---|---|---|
| `path` | `/api/cron/check-inactivity` | Endpoint del API Route que ejecuta la lógica de cierre automático. Ver `especificacion-api.md` para el detalle del endpoint. |
| `schedule` | `0 * * * *` | Expresión cron. Se ejecuta al inicio de cada hora, todos los días. Garantiza que ningún ticket permanezca más de 60 minutos adicionales en estado `EN_ESPERA_CLIENTE` después de cumplirse las 48 horas. |

> ⚠️ **Requisito de plan Vercel:** Los Cron Jobs con frecuencia horaria requieren el plan **Pro** de Vercel. El plan gratuito (Hobby) permite un máximo de 2 cron jobs con frecuencia mínima de una vez por día. Verificar el plan activo antes de desplegar y considerar el costo mensual del plan Pro en el presupuesto operativo del proyecto.

El archivo `vercel.json` debe commitearse al repositorio:

```bash
git add vercel.json
git commit -m "feat: agregar configuración de Vercel Cron Job para cierre automático"
git push origin dev
```

---

## 5. Flujo de Trabajo y Despliegue Continuo (CI/CD)

Vercel se integra directamente con GitHub y despliega automáticamente el proyecto ante cada push a las ramas configuradas. No se requiere ningún pipeline de CI/CD externo.

### 5.1. Entornos de Despliegue por Rama

| Rama Git | Entorno Vercel | URL | Trigger |
|---|---|---|---|
| `main` | **Production** | `https://ticketera.prontomatic.cl` | Automático en cada push o merge a `main`. |
| `qa` | **Preview (QA)** | URL generada por Vercel (ej: `prontoticket-qa-[hash].vercel.app`) | Automático en cada push a `qa`. |
| `dev` | **Preview (Dev)** | URL generada por Vercel (ej: `prontoticket-dev-[hash].vercel.app`) | Automático en cada push a `dev`. |

### 5.2. Ciclo de Desarrollo con CI/CD

El siguiente flujo describe el proceso completo desde el desarrollo de una nueva funcionalidad hasta su despliegue en producción:

```
1. Desarrollar en rama local dev
   └─► git push origin dev
         └─► Vercel despliega Preview (Dev) automáticamente
               └─► Verificar cambios en la URL de Preview (Dev)

2. Funcionalidad lista → merge dev → qa
   └─► git checkout qa && git merge dev && git push origin qa
         └─► Vercel despliega Preview (QA) automáticamente
               └─► Ejecutar pruebas funcionales en la URL de Preview (QA)

3. QA aprobado → merge qa → main
   └─► git checkout main && git merge qa && git push origin main
         └─► Vercel despliega en Production automáticamente
               └─► Sistema actualizado en ticketera.prontomatic.cl

4. Etiquetar el release (recomendado)
   └─► git tag v1.1.0 && git push origin v1.1.0
```

### 5.3. Reversar un Despliegue (Rollback)

Si un despliegue a producción introduce un error crítico, Vercel permite revertir instantáneamente al despliegue anterior:

1. En el Dashboard de Vercel → proyecto → **Deployments**.
2. Identificar el despliegue anterior estable (marcado con el estado "Ready").
3. Hacer clic en los tres puntos (`...`) del despliegue → **"Promote to Production"**.
4. El entorno de producción revierte al estado anterior en segundos, sin necesidad de hacer un `git revert`.

---

## 6. Verificación del Sistema

Una vez completada la instalación y configuración, ejecutar la siguiente lista de verificaciones para confirmar que todos los componentes están operativos.

### 6.1. Verificación del Entorno Local

```bash
# 1. Verificar que el servidor de desarrollo levanta sin errores
npm run dev
# Esperado: "▲ Next.js 14.x.x - Local: http://localhost:3000"

# 2. Verificar la conexión a PostgreSQL (Supabase)
npx prisma db pull
# Esperado: Sin errores de conexión

# 3. Abrir Prisma Studio para verificar las tablas
npx prisma studio
# Esperado: Interfaz visual con las tablas Ticket, Profile, Message, etc.
```

### 6.2. Verificación del Webhook de SendGrid

Para probar el endpoint de ingesta sin enviar un correo real:

1. En SendGrid Dashboard → Settings → Inbound Parse → (la configuración creada) → **"Test Your Integration"**.
2. SendGrid enviará un payload de prueba al endpoint configurado.
3. Verificar en los logs de Vercel (o en la consola local si se está en desarrollo) que el endpoint respondió con `200 OK`.

> Para pruebas locales del webhook, se puede usar [ngrok](https://ngrok.com) para exponer el servidor local a internet temporalmente: `ngrok http 3000`. La URL generada por ngrok se usa como Destination URL en Inbound Parse durante el desarrollo.

### 6.3. Verificación del Cron Job

Para verificar que el cron job está configurado correctamente en Vercel:

1. En el Dashboard de Vercel → proyecto → **Cron Jobs**.
2. Verificar que el job `/api/cron/check-inactivity` aparece en la lista con la programación `0 * * * *`.
3. Hacer clic en **"Trigger"** para ejecutarlo manualmente y verificar que responde con `200 OK`.

---

## 7. Mantenimiento y Logs

### 7.1. Monitoreo de Logs en Vercel

Vercel provee acceso a los logs de las Serverless Functions en tiempo real:

**Acceso a logs:**
Dashboard de Vercel → proyecto → **Logs**

**Filtros recomendados para monitoreo de ProntoTicket:**

| Qué monitorear | Filtro sugerido | Por qué |
|---|---|---|
| Intentos de webhook inválidos | Buscar `INVALID_WEBHOOK_SIGNATURE` o respuestas `403` en `/api/webhook/ingesta` | Detectar intentos de inyección o ataques al endpoint público de ingesta. |
| Errores de envío de correo | Buscar `SENDGRID_ERROR` o `502` en `/api/tickets/[id]/responder` | Identificar respuestas de agentes que no llegaron al cliente. |
| Ejecuciones del cron job | Buscar actividad en `/api/cron/check-inactivity` | Verificar que el cierre automático se ejecuta correctamente cada hora. |
| Errores de conexión a MySQL | Buscar `DB_CONNECTION_FAILURE` o errores de Prisma con `LEGACY_DATABASE_URL` | Detectar indisponibilidad de la base de datos legacy de Prontomatic. |

### 7.2. Prisma Studio (Gestión Visual de Datos)

Prisma Studio es una interfaz visual que permite consultar y modificar directamente los datos de la base de datos PostgreSQL. Útil para tareas de mantenimiento operativo sin necesidad de escribir SQL.

```bash
# Ejecutar Prisma Studio (solo en entorno local)
npx prisma studio
```

Disponible en `http://localhost:5555`. Permite:
- Consultar tickets, mensajes y registros de auditoría.
- Crear manualmente el primer usuario Administrador del sistema.
- Verificar que el esquema de base de datos está correctamente aplicado.
- Depurar datos durante el desarrollo.

> **Advertencia:** Prisma Studio se conecta a la base de datos configurada en `DATABASE_URL`. Si se está apuntando a la base de datos de producción, los cambios realizados desde Prisma Studio afectarán datos reales. Usar con precaución.

### 7.3. Actualización de Dependencias

Se recomienda revisar y actualizar las dependencias del proyecto periódicamente para mantener la seguridad y compatibilidad:

```bash
# Revisar paquetes desactualizados
npm outdated

# Actualizar dependencias dentro del rango de versiones definido en package.json
npm update

# Verificar vulnerabilidades de seguridad conocidas
npm audit

# Corregir vulnerabilidades automáticamente (cuando sea posible)
npm audit fix
```

### 7.4. Rotación de Credenciales

Las siguientes credenciales deben rotarse periódicamente como buena práctica de seguridad:

| Credencial | Frecuencia recomendada | Pasos |
|---|---|---|
| `SENDGRID_API_KEY` | Cada 90 días | Generar nueva API Key en SendGrid → actualizar en Vercel → eliminar la antigua. |
| `CRON_SECRET` | Cada 90 días | Generar nueva cadena (`openssl rand -base64 32`) → actualizar en Vercel → hacer un nuevo despliegue para que el cambio tome efecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo si se sospecha compromiso | Regenerar en Supabase Dashboard → actualizar en Vercel. Esta clave tiene acceso total a la base de datos; su rotación es crítica ante cualquier indicio de exposición. |

---

## 8. Solución de Problemas Frecuentes

### 8.1. Error: `Cannot find module '@prisma/client'`

**Causa:** El cliente de Prisma no ha sido generado o fue eliminado al limpiar `node_modules`.

**Solución:**
```bash
npm install
npx prisma generate
```

---

### 8.2. Error de conexión a PostgreSQL: `P1001: Can't reach database server`

**Causa:** El string de conexión en `DATABASE_URL` es incorrecto, o la IP desde la que se conecta no está en la lista de IPs permitidas de Supabase.

**Solución:**
1. Verificar que `DATABASE_URL` en `.env.local` es correcto (copiar directamente desde Supabase Dashboard → Project Settings → Database).
2. En Supabase Dashboard → Project Settings → Database → **"Connection Pooling"**, verificar que la conexión está habilitada.
3. Si se está en una red con IP dinámica, verificar en Supabase → Project Settings → **"Network"** si hay restricciones de IP configuradas.

---

### 8.3. El webhook de SendGrid devuelve `403 Forbidden`

**Causa:** La verificación de firma ECDSA está fallando.

**Posibles causas y soluciones:**

| Causa probable | Solución |
|---|---|
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` incorrecto | Verificar que el valor en las variables de entorno coincide exactamente con la clave pública mostrada en SendGrid Dashboard → Inbound Parse → Security Policy. |
| El cuerpo de la petición fue parseado antes de la verificación | Revisar el código del endpoint `/api/webhook/ingesta` y asegurarse de leer el raw body con `request.bytes()` **antes** de cualquier llamada a `request.formData()`. Ver `especificacion-api.md` sección 2.2 para el detalle del proceso correcto. |
| La Security Policy no está activa en SendGrid | En SendGrid Dashboard → Inbound Parse → editar la configuración → verificar que "Signature Verification" está habilitado. |

---

### 8.4. `npx prisma db push` falla con error de permisos

**Causa:** El usuario de base de datos no tiene permisos suficientes para crear tablas.

**Solución:** Verificar que `DATABASE_URL` está usando las credenciales del usuario `postgres` (usuario administrador) de Supabase, no las credenciales de un usuario con permisos restringidos. Las credenciales del usuario `postgres` están disponibles en Supabase Dashboard → Project Settings → Database → **"Connection string"** (sección "Direct connection").

---

### 8.5. El cron job no aparece en el Dashboard de Vercel

**Causa:** El archivo `vercel.json` no está en la raíz del repositorio o tiene un error de sintaxis JSON.

**Solución:**
```bash
# Verificar que vercel.json existe en la raíz del proyecto
ls vercel.json

# Verificar que el JSON es válido
cat vercel.json | node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('/dev/stdin','utf8')); console.log('JSON válido');"

# Si el archivo existe y es válido, hacer un nuevo despliegue
git add vercel.json
git commit -m "fix: verificar configuración de vercel.json"
git push origin dev
```

---

### 8.6. Variables de entorno no disponibles en producción

**Causa:** Las variables fueron configuradas en `.env.local` pero no fueron cargadas en el Dashboard de Vercel.

**Solución:**
1. Acceder a Vercel Dashboard → proyecto → Settings → **Environment Variables**.
2. Verificar que cada variable está presente y tiene el entorno correcto seleccionado (Production / Preview / Development).
3. Después de agregar o modificar variables en Vercel, es necesario **hacer un nuevo despliegue** para que los cambios tomen efecto. Las variables no se aplican retroactivamente a despliegues existentes.

