# Contexto de Negocio - Sistema ProntoTicket

## 1. Visión General de Prontomatic

Prontomatic es una organización líder en el mercado chileno, especializada en proveer soluciones integrales de lavandería a través de modelos de autoatención y dispensación automática. Su operación es crítica para miles de usuarios en diversos sectores:

- **Sector Residencial:** Gestión de salas de lavado en edificios y condominios.
- **Sector Industrial y Retail:** Soluciones para centros comerciales y empresas de gran escala.
- **Sector Salud y Hotelería:** Operación en entornos que requieren alta disponibilidad y estándares de higiene rigurosos.

La empresa ha digitalizado parte de su experiencia de usuario (ej. Prontomatic App), pero el soporte administrativo y técnico ha permanecido anclado a procesos manuales que hoy limitan su escalabilidad.

---

## 2. Diagnóstico del Estado Actual (Proceso "As-Is")

Actualmente, toda la interacción de soporte se centraliza en la casilla única: **contacto@prontomatic.cl**. Este buzón funciona como un "buzón compartido" donde los agentes leen y responden correos de manera lineal y manual.

### 2.1. Flujo de Trabajo Vigente

- El cliente envía un correo con una queja o requerimiento.
- Los agentes de turno revisan la bandeja de entrada compartida.
- Un agente responde el correo (si lo identifica como pendiente).
- El seguimiento se realiza mediante el historial de "Enviados" o carpetas manuales en el cliente de correo.

---

## 3. Análisis de la Problemática y Puntos de Dolor

La gestión manual a través de un buzón de correo convencional ha generado una crisis operativa dividida en los siguientes pilares críticos:

### 3.1. Inexistencia de Trazabilidad Histórica

No existe una ficha única por cliente que consolide sus interacciones pasadas. Si un residente reporta una falla en una lavadora hoy, el agente no tiene visibilidad inmediata de si ese mismo cliente reportó el mismo problema la semana pasada, a menos que realice búsquedas manuales exhaustivas por remitente.

### 3.2. Ausencia de Estados y Seguimiento Formal

El correo electrónico no posee un sistema de estados (Abierto, En Espera, Resuelto). Esto provoca un fenómeno de "casos perdidos", donde solicitudes que requieren respuesta del cliente o de un técnico externo quedan en el olvido al ser desplazadas por correos nuevos en la bandeja de entrada.

### 3.3. Desequilibrio en la Carga Operativa

Al no haber una asignación o "toma" formal de casos, la distribución del trabajo es errática. Es común que varios agentes visualicen el mismo requerimiento sin que ninguno actúe por asumir que otro ya lo hizo, o que un solo agente termine absorbiendo la mayoría de los casos complejos por falta de visibilidad del supervisor.

### 3.4. Opacidad en el Desempeño y Auditoría

La gerencia de Prontomatic no puede realizar auditorías objetivas. Es imposible determinar con exactitud:

- Cuántos correos atendió cada agente por jornada.
- La calidad o precisión técnica de las respuestas entregadas.
- El tiempo que transcurre desde que el cliente escribe hasta que recibe una solución real (no solo una respuesta de cortesía).

### 3.5. Carencia de Inteligencia de Datos (Métricas)

La falta de un sistema estructurado impide identificar patrones. Prontomatic no puede saber qué edificios reportan más fallas, qué modelos de máquinas son más problemáticos o en qué horarios se satura el servicio, imposibilitando la toma de decisiones basada en evidencia.

---

## 4. Propuesta de Valor de ProntoTicket

ProntoTicket surge como la solución tecnológica definitiva para transformar este "caos de correos" en un flujo de datos ordenado, profesional y auditable.

### 4.1. Transformación Digital del Soporte

El sistema automatiza la ingesta mediante **SendGrid Inbound Parse**, eliminando el error humano en la fase de registro. Al centralizar todo en una base de datos **PostgreSQL**, la información deja de pertenecer a un buzón y pasa a ser un activo de la empresa.

### 4.2. Enriquecimiento Proactivo del Caso

A diferencia del correo manual, el sistema consulta automáticamente el RUT, dirección y teléfono del cliente en la base de datos de Prontomatic al momento de crear el ticket. Esto otorga al agente un contexto inmediato que reduce los tiempos de diagnóstico.

---

## 5. Objetivos Estratégicos del Negocio

- **Excelencia en el Servicio:** Reducir el tiempo de resolución final mediante el protocolo de llamada única y seguimiento por ticket.
- **Transparencia con el Cliente:** Mantener al cliente informado automáticamente sobre el estado de su requerimiento, eliminando la incertidumbre.
- **Optimización del Talento Humano:** Permitir que los agentes gestionen su carga de trabajo de forma proactiva mediante el dashboard centralizado.
- **Cultura de Medición:** Establecer una línea base de SLAs y satisfacción (encuestas automáticas) para elevar el estándar de calidad de la marca.

---

## 6. Matriz de Stakeholders (Interesados)

| Interesado              | Impacto del Proyecto                                                                 |
|------------------------|--------------------------------------------------------------------------------------|
| Agentes de Soporte     | Reducción de estrés operativo, claridad en responsabilidades y herramientas de comunicación eficientes. |
| Supervisores           | Capacidad de monitoreo en tiempo real, balanceo de carga y acceso a métricas de desempeño. |
| Clientes Prontomatic   | Recepción de respuestas más rápidas, seguimiento formal de sus casos y sensación de atención personalizada. |
| Gerencia General       | Acceso a reportes de calidad, cumplimiento de SLA y datos estratégicos para la operación. |