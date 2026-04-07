# ProntoTicket

> Sistema interno de gestión de tickets de soporte para Prontomatic.

---

## Índice

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Contexto y Problemática](#2-contexto-y-problemática)
3. [Objetivo General](#3-objetivo-general)
4. [Objetivos Específicos](#4-objetivos-específicos)
5. [Alcance del Sistema](#5-alcance-del-sistema)
6. [Fuera del Alcance](#6-fuera-del-alcance)
7. [Stack Tecnológico](#7-stack-tecnológico)
8. [Roles del Sistema](#8-roles-del-sistema)
9. [Canal de Entrada](#9-canal-de-entrada)
10. [Estado del Proyecto](#10-estado-del-proyecto)
11. [Estructura del Repositorio](#11-estructura-del-repositorio)
12. [Equipo](#12-equipo)
13. [Documentación Relacionada](#13-documentación-relacionada)

---

## 1. Descripción del Proyecto

**ProntoTicket** es un sistema interno de gestión de tickets de soporte desarrollado a medida para **Prontomatic**, empresa chilena especializada en soluciones de dispensación automática y autoatención para los sectores retail, industrial, residencial y hotelero.

El sistema tiene como propósito centralizar, ordenar y hacer trazable toda la comunicación entre los clientes de Prontomatic y el equipo de soporte técnico, reemplazando el flujo actual basado en la gestión manual del buzón de correo electrónico de contacto.

ProntoTicket opera a través del correo de contacto de Prontomatic mediante un servicio de webhook, en este caso SendGrid, que se encarga de recibir los correos y enviarlos al sistema.

---

## 2. Contexto y Problemática

Prontomatic presta servicios de soporte técnico a sus clientes a través del correo electrónico `contacto@prontomatic.cl`. Actualmente, este buzón es el único canal oficial de comunicación entre los clientes y el equipo de soporte, y toda la gestión de incidencias, consultas y solicitudes se realiza directamente desde ese buzón compartido.

Esta modalidad presenta una serie de problemas estructurales que impactan tanto la calidad del servicio como la capacidad de gestión interna:

### 2.1. Falta de trazabilidad

No existe un registro estructurado del historial de comunicaciones por cliente o por caso. Una vez que un correo es respondido o archivado, el seguimiento del caso depende enteramente de la memoria del agente o de búsquedas manuales en el buzón.

### 2.2. Ausencia de seguimiento formal

No hay un mecanismo que permita saber en qué estado se encuentra un caso en un momento dado: si está siendo atendido, si está esperando respuesta del cliente, si fue resuelto o si simplemente quedó sin respuesta. Esto genera casos que se pierden o quedan abiertos indefinidamente sin resolución.

### 2.3. Distribución de carga desordenada

Al trabajar sobre un buzón compartido, no existe claridad sobre qué agente es responsable de qué caso. Varios agentes pueden estar viendo el mismo correo sin que ninguno lo tome, o bien un agente puede tomar múltiples casos mientras otro permanece sin trabajo, generando una distribución desequilibrada.

### 2.4. Imposibilidad de auditoría

No hay forma de medir el desempeño individual de los agentes. No se puede determinar cuántos casos resolvió un agente, en cuánto tiempo, con qué nivel de satisfacción del cliente, ni si cumplió con los tiempos de respuesta esperados.

### 2.5. Sin métricas de calidad

La ausencia de un sistema formal impide recopilar datos sobre los tiempos de resolución, la satisfacción de los clientes, los tipos de problemas más recurrentes, o las épocas de mayor carga de trabajo, lo que imposibilita la toma de decisiones basada en datos.

---

## 3. Objetivo General

Desarrollar e implementar un sistema de gestión de tickets de soporte interno que permita a Prontomatic centralizar, ordenar, hacer trazable y auditable toda la gestión de solicitudes de soporte de sus clientes, mejorando la calidad del servicio, la eficiencia operativa del equipo y la capacidad de supervisión y análisis de la operación.

---

## 4. Objetivos Específicos

1. **Automatizar la creación de tickets** a partir de los correos recibidos en `contacto@prontomatic.cl`, eliminando la necesidad de intervención manual para registrar nuevos casos.

2. **Centralizar la gestión** en un dashboard único accesible para todos los agentes y supervisores, con visibilidad completa sobre el estado de cada ticket en tiempo real.

3. **Estandarizar el flujo de trabajo** mediante estados de ticket bien definidos y transiciones controladas, garantizando que cada caso siga un ciclo de vida claro desde su apertura hasta su cierre.

4. **Enriquecer la información de cada ticket** con datos del cliente (RUT, teléfono, dirección) consultados automáticamente en la base de datos interna de Prontomatic al momento de la creación del ticket.

5. **Habilitar el seguimiento cronológico** de cada caso a través de un hilo de comunicación interno que consolide todas las interacciones relacionadas con un ticket.

6. **Implementar reglas automáticas de cierre** para tickets que permanezcan inactivos por más de 48 horas sin respuesta del cliente, incluyendo notificación previa al cliente antes del cierre.

7. **Medir la satisfacción del cliente** mediante el envío automático de una encuesta tras el cierre de cada ticket.

8. **Proveer herramientas de supervisión y auditoría** que permitan a supervisores y administradores monitorear el desempeño individual de los agentes, medir cumplimiento de SLA y analizar la operación en su conjunto.

---

## 5. Alcance del Sistema

ProntoTicket cubre los siguientes procesos dentro de su versión inicial:

- **Ingesta automática de correos** desde `contacto@prontomatic.cl` y conversión en tickets estructurados.
- **Normalización del contenido** de los correos (conversión de HTML a Markdown, extracción de adjuntos, asunto, remitente y cuerpo).
- **Enriquecimiento automático** del ticket con datos del cliente mediante consulta a la base de datos interna.
- **Dashboard centralizado** para visualización y gestión de tickets por parte de agentes y supervisores.
- **Toma manual de tickets** por parte de los agentes desde el dashboard compartido.
- **Hilo de comunicación** por ticket, que consolida toda la interacción entre el agente y el cliente.
- **Gestión de estados** del ticket a lo largo de su ciclo de vida.
- **Protocolo de cierre automático** por inactividad superior a 48 horas, con notificación previa al cliente.
- **Encuesta de satisfacción** enviada automáticamente al cierre del ticket.
- **Panel de supervisión y métricas** para el seguimiento del desempeño de agentes y cumplimiento de SLA.
- **Gestión de roles y permisos** diferenciados para Agente, Supervisor y Administrador.
- **Gestión de categorías** de tickets para clasificación de casos.

---

## 6. Fuera del Alcance

Los siguientes aspectos quedan explícitamente **excluidos** del alcance de la versión inicial de ProntoTicket:

- Canales de entrada adicionales como formulario web, WhatsApp, chat en vivo o llamadas telefónicas. El único canal de entrada es el correo electrónico.
- Portal de autoservicio para clientes (consulta de estado de tickets por parte del cliente desde una interfaz web).
- Aplicación móvil nativa.
- Módulo de facturación o cobro asociado a tickets.

---

## 7. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend & API | Next.js (App Router) |
| Backend Runtime | Node.js |
| Base de Datos | PostgreSQL (alojado en Supabase) |
| ORM | Prisma |
| Servicio de Webhook / Email | SendGrid (Inbound Parse) |

---

## 8. Roles del Sistema

ProntoTicket contempla tres roles de usuario internos:

| Rol | Descripción |
|---|---|
| **Agente de Soporte** | Usuario operativo. Visualiza el dashboard, toma tickets de forma manual, gestiona la comunicación con el cliente y actualiza el estado de los casos. |
| **Supervisor / Jefe de Turno** | Tiene todas las capacidades del agente, además de acceso a métricas de desempeño del equipo, vista global de la carga de trabajo y herramientas de supervisión en tiempo real. |
| **Administrador del Sistema** | Tiene acceso total al sistema. Gestiona usuarios, roles, categorías de tickets, configuraciones generales y parámetros del sistema. |

> **Nota:** No existe un rol de acceso para clientes. Los clientes interactúan con el sistema únicamente a través del correo electrónico.

---

## 9. Canal de Entrada

El único canal oficial de entrada de tickets es el correo electrónico corporativo:

```
contacto@prontomatic.cl
```

Cualquier mensaje recibido en este buzón es procesado automáticamente por el motor de ingesta de ProntoTicket a través de **SendGrid Inbound Parse**, que actúa como webhook receptor y reenvía el contenido del correo al sistema para su validación, normalización y conversión en ticket.

---

## 10. Estado del Proyecto

| Atributo | Detalle |
|---|---|
| **Estado actual** | 🟡 En fase de planificación y documentación |
| **Fase** | Pre-desarrollo |
| **Próximo hito** | Inicio del desarrollo del MVP |

---

## 11. Estructura del Repositorio

```
/
├── Docs/                          # Documentación del proyecto
│   ├── README.md                  # Este archivo (visión general)
│   ├── contexto-negocio.md        # Contexto de negocio y descripción de Prontomatic
│   ├── arquitectura-proyecto.md   # Arquitectura general del proyecto
│   ├── definicion-tecnica.md      # Arquitectura lógica y procesos técnicos
│   ├── alcance-funcional.md       # Alcance funcional detallado por módulo
│   ├── diagrama-de-flujo.md       # Descripción textual del flujo del sistema
│   ├── modelo-de-datos.md         # Esquema de base de datos y entidades
│   ├── especificacion-api.md      # Especificación de endpoints REST
│   ├── diseño-visual.md           # Sistema de diseño visual y UX
│   ├── templates-emails.md        # Templates de los 4 correos automáticos
│   ├── manual-agentes.md          # Manual de usuario para agentes
│   └── guia-instalacion.md        # Guía de instalación, configuración y despliegue
├── src/                           # Código fuente de la aplicación
└── ...
```

> La estructura del repositorio será actualizada a medida que el proyecto avance.

---

## 12. Equipo

| Rol | Nombre |
|---|---|
| **Desarrollador** | Domingo Velazquez |
| **Asesor** | Joan Toro |

---

## 13. Documentación Relacionada

Todos los documentos de referencia del proyecto se encuentran en la carpeta `/Docs`:

- [`contexto-negocio.md`](./contexto-negocio.md) — Descripción detallada de Prontomatic, su modelo de negocio y el contexto operativo que da origen al proyecto.
- [`arquitectura-proyecto.md`](./arquitectura-proyecto.md) — Arquitectura general del sistema, decisiones de diseño, Vercel y flujo Git.
- [`definicion-tecnica.md`](./definicion-tecnica.md) — Arquitectura lógica, stack tecnológico, flujos de ingesta, gestión y cierre de tickets.
- [`alcance-funcional.md`](./alcance-funcional.md) — Alcance funcional detallado por módulo, requerimientos no funcionales y decisiones pendientes.
- [`diagrama-de-flujo.md`](./diagrama-de-flujo.md) — Descripción textual paso a paso del flujo completo del sistema.
- [`modelo-de-datos.md`](./modelo-de-datos.md) — Entidades, atributos, relaciones, schema Prisma completo y reglas de integridad.
- [`especificacion-api.md`](./especificacion-api.md) — Endpoints REST disponibles, métodos, parámetros y respuestas.
- [`diseño-visual.md`](./diseño-visual.md) — Sistema de diseño visual, paleta de colores, tipografía y especificación de componentes UI.
- [`templates-emails.md`](./templates-emails.md) — Templates de los 4 correos automáticos del sistema con variables dinámicas y consideraciones técnicas.
- [`manual-agentes.md`](./manual-agentes.md) — Guía de uso del sistema dirigida a los agentes de soporte.
- [`guia-instalacion.md`](./guia-instalacion.md) — Guía de instalación, configuración de servicios externos y despliegue en Vercel.

