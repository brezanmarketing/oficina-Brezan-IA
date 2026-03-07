__OFICINA DE IA__

Sistema JARVIS

FASE 3 — Sistema de Tareas, Proyectos y Agentes Autónomos

__3/6__

FASE

__12__

TABLAS SQL

__6__

MÓDULOS

__∞__

AUTONOMÍA

# __1\. Qué Construye la Fase 3__

La Fase 2 dio a Jarvis manos y herramientas\. La Fase 3 le da cerebro organizativo: la capacidad de recibir objetivos complejos, descomponerlos en tareas, contratar los agentes adecuados y coordinar su trabajo en paralelo sin que tú intervengas\.

## __Sin Fase 3__

- Jarvis recibe una tarea y la ejecuta solo
- Sin memoria de proyectos anteriores
- No puede dividir trabajo entre agentes
- Sin seguimiento de progreso
- Cada tarea empieza desde cero

## __Con Fase 3__

- Jarvis recibe un objetivo y lo convierte en proyecto
- Descompone en subtareas automáticamente
- Asigna cada subtarea al agente más adecuado
- Ejecuta en paralelo cuando es posible
- Aprende de cada proyecto para mejorar el siguiente

__EJEMPLO REAL__

Tú dices: "Analiza la competencia de mi empresa y prepara un informe"\. Jarvis crea un proyecto con 5 tareas: buscar competidores \(Web Search\), scrapear sus webs \(Web Browser\), analizar precios \(Data Analyzer\), resumir hallazgos \(modelo IA\), generar PDF \(File Manager\)\. Todo en paralelo\. Tú recibes el informe en Telegram\.

# __2\. Arquitectura del Sistema__

## __Los 6 Módulos de la Fase 3__

__\#__

__Módulo__

__Archivo__

__Responsabilidad__

__M1__

__Task Decomposer__

task\-decomposer\.ts

Convierte un objetivo en tareas concretas usando IA

__M2__

__Agent Spawner__

agent\-spawner\.ts

Crea y configura agentes según el tipo de tarea

__M3__

__Task Queue__

task\-queue\.ts

Cola priorizada con dependencias y paralelización

__M4__

__Project Manager__

project\-manager\.ts

Orquesta proyectos completos de principio a fin

__M5__

__Progress Tracker__

progress\-tracker\.ts

Monitoriza estado en tiempo real y gestiona fallos

__M6__

__Learning Engine__

learning\-engine\.ts

Aprende de cada proyecto para mejorar el siguiente

## __Estructura de Carpetas__

/office

  /jarvis

    /phase3

      task\-decomposer\.ts    ← M1

      agent\-spawner\.ts      ← M2

      task\-queue\.ts         ← M3

      project\-manager\.ts    ← M4

      progress\-tracker\.ts   ← M5

      learning\-engine\.ts    ← M6

      index\.ts              ← Orquestador principal

    /agents

      agent\-profiles/       ← Plantillas por tipo de agente

      active\-agents/        ← Agentes corriendo ahora

## __Flujo Completo de una Tarea__

__OBJETIVO DEL USUARIO__

↓

M1: Task Decomposer → 3\-10 subtareas concretas

↓

M2: Agent Spawner → crea agente óptimo por tarea

↓

M3: Task Queue → ordena por dependencias y prioridad

↓

M4: Project Manager → ejecuta en paralelo cuando posible

↓

M5: Progress Tracker → monitoriza, reintenta si falla

↓

M6: Learning Engine → guarda aprendizajes para el próximo proyecto

# __3\. SQL Completo para Supabase__

Ejecutar en Supabase > SQL Editor antes de implementar ningún módulo\. Estas tablas son el sistema nervioso de toda la Fase 3\.

## __Tabla: projects__

\-\- Proyectos: agrupan tareas con un objetivo común

CREATE TABLE projects \(

  id            UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  title         TEXT NOT NULL,

  objective     TEXT NOT NULL,          \-\- objetivo original del usuario

  status        TEXT DEFAULT 'pending'

                CHECK \(status IN \('pending','planning','running',

                                  'paused','completed','failed'\)\),

  priority      INTEGER DEFAULT 5,       \-\- 1=crítico, 10=bajo

  progress\_pct  INTEGER DEFAULT 0,

  created\_by    TEXT DEFAULT 'user',     \-\- user | jarvis | trigger

  context       JSONB,                   \-\- metadata del proyecto

  result        JSONB,                   \-\- output final consolidado

  error\_log     TEXT\[\],

  started\_at    TIMESTAMPTZ,

  completed\_at  TIMESTAMPTZ,

  deadline      TIMESTAMPTZ,

  created\_at    TIMESTAMPTZ DEFAULT NOW\(\)

\);

## __Tabla: tasks__

\-\- Tareas individuales dentro de un proyecto

CREATE TABLE tasks \(

  id             UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  project\_id     UUID REFERENCES projects\(id\) ON DELETE CASCADE,

  title          TEXT NOT NULL,

  description    TEXT,

  status         TEXT DEFAULT 'pending'

                 CHECK \(status IN \('pending','queued','running',

                                   'completed','failed','skipped'\)\),

  priority       INTEGER DEFAULT 5,

  depends\_on     UUID\[\],               \-\- IDs de tareas que deben terminar antes

  assigned\_agent UUID,                 \-\- REFERENCES agents\(id\)

  tools\_needed   TEXT\[\],               \-\- tools de Fase 2 que necesita

  model\_hint     TEXT,                 \-\- 'fast'|'smart'|'vision'|'code'

  input\_data     JSONB,

  output\_data    JSONB,

  retry\_count    INTEGER DEFAULT 0,

  max\_retries    INTEGER DEFAULT 3,

  timeout\_ms     INTEGER DEFAULT 120000,

  started\_at     TIMESTAMPTZ,

  completed\_at   TIMESTAMPTZ,

  created\_at     TIMESTAMPTZ DEFAULT NOW\(\)

\);

CREATE INDEX idx\_tasks\_project ON tasks\(project\_id\);

CREATE INDEX idx\_tasks\_status  ON tasks\(status\);

CREATE INDEX idx\_tasks\_agent   ON tasks\(assigned\_agent\);

## __Tabla: agents__

\-\- Agentes creados por Jarvis para ejecutar tareas

CREATE TABLE agents \(

  id            UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  name          TEXT NOT NULL,

  role          TEXT NOT NULL,          \-\- researcher|coder|writer|analyst|etc

  model         TEXT NOT NULL,          \-\- gpt\-4o|gemini\-pro|gemini\-flash|etc

  status        TEXT DEFAULT 'idle'

                CHECK \(status IN \('idle','busy','error','retired'\)\),

  system\_prompt TEXT,

  tools         TEXT\[\],                 \-\- tools que puede usar

  capabilities  TEXT\[\],

  current\_task  UUID,

  tasks\_done    INTEGER DEFAULT 0,

  tasks\_failed  INTEGER DEFAULT 0,

  avg\_duration  INTEGER,                \-\- ms promedio por tarea

  performance   DECIMAL\(3,2\),           \-\- 0\.00\-1\.00 score

  budget\_tokens INTEGER DEFAULT 100000, \-\- límite de tokens

  tokens\_used   INTEGER DEFAULT 0,

  created\_by    TEXT DEFAULT 'jarvis',

  retired\_at    TIMESTAMPTZ,

  created\_at    TIMESTAMPTZ DEFAULT NOW\(\)

\);

## __Tabla: task\_dependencies__

\-\- Grafo de dependencias entre tareas \(para paralelización\)

CREATE TABLE task\_dependencies \(

  task\_id       UUID REFERENCES tasks\(id\) ON DELETE CASCADE,

  depends\_on\_id UUID REFERENCES tasks\(id\) ON DELETE CASCADE,

  PRIMARY KEY \(task\_id, depends\_on\_id\)

\);

## __Tabla: agent\_messages__

\-\- Canal de comunicación inter\-agentes

CREATE TABLE agent\_messages \(

  id          UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  from\_agent  TEXT NOT NULL,            \-\- agent\_id o 'jarvis' o 'user'

  to\_agent    TEXT NOT NULL,

  project\_id  UUID,

  task\_id     UUID,

  type        TEXT,                     \-\- instruction|result|question|alert

  content     JSONB NOT NULL,

  read        BOOLEAN DEFAULT FALSE,

  created\_at  TIMESTAMPTZ DEFAULT NOW\(\)

\);

## __Tabla: project\_templates__

\-\- Plantillas de proyectos exitosos \(Learning Engine las crea\)

CREATE TABLE project\_templates \(

  id            UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  name          TEXT NOT NULL,

  category      TEXT,

  trigger\_words TEXT\[\],                 \-\- palabras que activan este template

  task\_plan     JSONB NOT NULL,          \-\- estructura de tareas probada

  avg\_duration  INTEGER,                 \-\- ms promedio de ejecucion

  success\_rate  DECIMAL\(3,2\),

  use\_count     INTEGER DEFAULT 0,

  created\_at    TIMESTAMPTZ DEFAULT NOW\(\)

\);

## __Tabla: knowledge\_base__

\-\- Memoria persistente que crece con cada proyecto

CREATE TABLE knowledge\_base \(

  id          UUID PRIMARY KEY DEFAULT gen\_random\_uuid\(\),

  category    TEXT,                     \-\- fact|process|preference|mistake

  title       TEXT NOT NULL,

  content     TEXT NOT NULL,

  source      TEXT,                     \-\- project\_id que generó este conocimiento

  relevance   DECIMAL\(3,2\) DEFAULT 1\.0, \-\- decrece si no se usa

  tags        TEXT\[\],

  used\_count  INTEGER DEFAULT 0,

  created\_at  TIMESTAMPTZ DEFAULT NOW\(\),

  updated\_at  TIMESTAMPTZ DEFAULT NOW\(\)

\);

## __Funciones SQL Clave__

\-\- Obtener tareas listas para ejecutar \(dependencias resueltas\)

CREATE OR REPLACE FUNCTION get\_ready\_tasks\(p\_project\_id UUID\)

RETURNS SETOF tasks AS $$

  SELECT t\.\* FROM tasks t

  WHERE t\.project\_id = p\_project\_id

    AND t\.status = 'pending'

    AND NOT EXISTS \(

      SELECT 1 FROM task\_dependencies td

      JOIN tasks dep ON dep\.id = td\.depends\_on\_id

      WHERE td\.task\_id = t\.id

        AND dep\.status \!= 'completed'

    \)

  ORDER BY t\.priority ASC;

$$ LANGUAGE sql;

\-\- Calcular progreso de un proyecto

CREATE OR REPLACE FUNCTION project\_progress\(p\_id UUID\)

RETURNS INTEGER AS $$

  SELECT COALESCE\(

    ROUND\(100\.0 \* COUNT\(\*\) FILTER \(WHERE status='completed'\) / NULLIF\(COUNT\(\*\),0\)\),

    0\)::INTEGER

  FROM tasks WHERE project\_id = p\_id;

$$ LANGUAGE sql;

# __4\. Prompts de Implementación — Módulo a Módulo__

__ORDEN OBLIGATORIO__

Implementar M1 → M2 → M3 → M4 → M5 → M6\. Cada módulo depende del anterior\. No saltarse ninguno\.

M1  __Task Decomposer__

Convierte objetivos en planes de acción

El cerebro de la planificación\. Recibe un objetivo en lenguaje natural y usa el modelo de IA más inteligente disponible para descomponerlo en 3\-10 tareas concretas, ordenadas y con dependencias definidas\.

// PROMPT PARA ANTIGRAVITY — M1: Task Decomposer

// Archivo: /office/jarvis/phase3/task\-decomposer\.ts

Crea el módulo Task Decomposer con estas funciones:

decomposeObjective\(objective: string, context?: any\): Promise<TaskPlan>

  \- Llama a GPT\-4o con este system prompt:

    'Eres un experto en gestión de proyectos\. Dado un objetivo,

     crea un plan de tareas concretas, ordenadas y ejecutables\.

     Responde SOLO en JSON con el schema TaskPlan\.'

  \- El JSON debe incluir por cada tarea:

    \{ title, description, tools\_needed\[\], model\_hint,

      depends\_on\[\], priority, estimated\_duration\_ms \}

  \- Guardar el plan en Supabase tabla tasks

  \- Máximo 10 tareas por objetivo

estimateComplexity\(objective: string\): 'simple'|'medium'|'complex'

  \- simple: 1\-3 tareas, 1 agente, <5 min

  \- medium: 4\-6 tareas, 2\-3 agentes, <30 min

  \- complex: 7\+ tareas, 4\+ agentes, >30 min

suggestTemplate\(objective: string\): Promise<ProjectTemplate | null>

  \- Busca en project\_templates si hay uno similar

  \- Usa embeddings o matching de palabras clave

  \- Si existe con success\_rate > 0\.8, reutilizarlo

refineWithFeedback\(plan: TaskPlan, feedback: string\): Promise<TaskPlan>

  \- Permite ajustar el plan antes de ejecutar

Tests obligatorios:

  \- Objetivo simple → exactamente 1\-3 tareas

  \- Objetivo complejo → dependencias correctas

  \- Template encontrado → se reutiliza

M2  __Agent Spawner__

Crea el agente perfecto para cada tarea

Jarvis como RRHH: para cada tipo de tarea, selecciona el modelo de IA óptimo, configura el system prompt específico, asigna las tools necesarias y controla el presupuesto de tokens\.

### __Perfiles de Agentes Disponibles__

__Rol__

__Modelo__

__Tools__

__Cuándo usarlo__

__Researcher__

Gemini Flash

web\-search, web\-browser

Buscar información, noticias, datos

__Analyst__

GPT\-4o

data\-analyzer, file\-manager

Analizar datos, detectar patrones

__Writer__

Gemini Pro

file\-manager

Redactar informes, emails, contenido

__Coder__

GPT\-4o

code\-executor, file\-manager

Escribir y ejecutar código

__Communicator__

Gemini Flash

email\-manager, communications

Enviar notificaciones y emails

__Coordinator__

GPT\-4o

Todas

Tareas complejas que requieren múltiples tools

// PROMPT PARA ANTIGRAVITY — M2: Agent Spawner

// Archivo: /office/jarvis/phase3/agent\-spawner\.ts

Crea el módulo Agent Spawner con estas funciones:

spawnAgent\(task: Task\): Promise<Agent>

  \- Analiza task\.tools\_needed y task\.model\_hint

  \- Selecciona el perfil de agente más adecuado

  \- Instancia el agente con system prompt específico para la tarea

  \- Registra en tabla agents con status 'idle'

  \- Antes de crear nuevo: buscar agente idle con mismo perfil \(reutilizar\)

selectModel\(task: Task\): string

  \- model\_hint='fast'  → gemini\-flash \(barato, rápido\)

  \- model\_hint='smart' → gpt\-4o \(inteligente, costoso\)

  \- model\_hint='code'  → gpt\-4o \(mejor para código\)

  \- model\_hint='vision'→ gemini\-pro\-vision \(si hay imágenes\)

  \- Default: analizar complejidad de task\.description

retireAgent\(agent\_id: UUID\): Promise<void>

  \- Marca el agente como 'retired' en BD

  \- Guarda métricas finales \(tasks\_done, avg\_duration, performance\)

getAgentPool\(\): Promise<AgentStats>

  \- Cuántos agentes activos, idle, y por rol

  \- Coste total de tokens consumidos hoy

buildSystemPrompt\(role: string, task: Task\): string

  \- Genera system prompt dinámico según rol y contexto de tarea

  \- Incluye: personalidad, herramientas disponibles, restricciones

  \- Consulta knowledge\_base para añadir contexto relevante

M3  __Task Queue__

Cola inteligente con dependencias y paralelización

El director de tráfico\. Garantiza que las tareas se ejecuten en el orden correcto, que las independientes corran en paralelo \(máximo 5 simultáneas\) y que ninguna se pierda si hay un fallo\.

// PROMPT PARA ANTIGRAVITY — M3: Task Queue

// Archivo: /office/jarvis/phase3/task\-queue\.ts

Crea el módulo Task Queue con estas funciones:

enqueueProject\(project\_id: UUID\): Promise<void>

  \- Llama a get\_ready\_tasks\(\) de Supabase

  \- Encola todas las tareas sin dependencias pendientes

  \- Marca su status como 'queued'

getNextBatch\(max\_concurrent: number = 5\): Promise<Task\[\]>

  \- Devuelve hasta max\_concurrent tareas listas

  \- Prioriza por: priority ASC, created\_at ASC

  \- Verifica que las dependencias están completed

  \- Nunca devolver más de 1 tarea por agente

markComplete\(task\_id: UUID, output: any\): Promise<void>

  \- Actualiza status a 'completed', guarda output\_data

  \- Desbloquea tareas que dependían de esta

  \- Llama a project\_progress\(\) y actualiza projects\.progress\_pct

  \- Si todas las tareas están done → marcar proyecto como completed

markFailed\(task\_id: UUID, error: string\): Promise<void>

  \- Incrementa retry\_count

  \- Si retry\_count < max\_retries → volver a 'pending'

  \- Si retry\_count >= max\_retries → status 'failed', alertar a Jarvis

pauseProject\(project\_id: UUID\): Promise<void>

resumeProject\(project\_id: UUID\): Promise<void>

getQueueStats\(\): Promise<QueueStats>

  \- Tareas pending, queued, running, completadas hoy

  \- Tiempo medio de ejecución por tipo de tarea

M4  __Project Manager__

Orquestador principal de proyectos

El director de orquesta\. Recibe el objetivo del usuario, coordina todos los módulos anteriores y lleva el proyecto desde el inicio hasta la entrega del resultado final\.

// PROMPT PARA ANTIGRAVITY — M4: Project Manager

// Archivo: /office/jarvis/phase3/project\-manager\.ts

Crea el módulo Project Manager — es el punto de entrada principal\.

createProject\(objective: string, options?\): Promise<Project>

  1\. Llama a TaskDecomposer\.decomposeObjective\(\)

  2\. Crea registro en tabla projects

  3\. Guarda todas las tareas en tabla tasks

  4\. Llama a TaskQueue\.enqueueProject\(\)

  5\. Notifica al usuario por Telegram: 'Proyecto creado: X tareas'

  6\. Devuelve el proyecto creado

runProject\(project\_id: UUID\): Promise<void>

  Loop principal \(ejecutar cada 3 segundos\):

  1\. getNextBatch\(\) → obtener tareas listas

  2\. Por cada tarea: spawnAgent\(\) \+ executeTask\(\)

  3\. Cuando tarea completa: markComplete\(\) \+ desencolar siguiente

  4\. Si fallo: markFailed\(\) \+ aplicar retry logic

  5\. Actualizar progress en Supabase en tiempo real

  6\. Si progreso = 100%: finalizeProject\(\)

executeTask\(task: Task, agent: Agent\): Promise<TaskResult>

  \- Construye el prompt específico para la tarea

  \- Inyecta outputs de tareas dependientes como contexto

  \- Llama al modelo con las tools apropiadas

  \- Timeout según task\.timeout\_ms

  \- Devuelve resultado estructurado

finalizeProject\(project\_id: UUID\): Promise<void>

  1\. Recopila todos los outputs de tareas completadas

  2\. Genera resumen ejecutivo con GPT\-4o

  3\. Guarda resultado en projects\.result

  4\. Notifica usuario con resumen por Telegram

  5\. Llama a LearningEngine\.learnFromProject\(\)

getProjectStatus\(project\_id: UUID\): Promise<ProjectStatus>

listProjects\(filter?\): Promise<Project\[\]>

M5  __Progress Tracker__

Monitorización en tiempo real

Los ojos de Jarvis\. Detecta agentes bloqueados, tareas que tardan demasiado, patrones de fallo y envía alertas proactivas antes de que los problemas se conviertan en errores\.

// PROMPT PARA ANTIGRAVITY — M5: Progress Tracker

// Archivo: /office/jarvis/phase3/progress\-tracker\.ts

Crea el módulo Progress Tracker con estas funciones:

startMonitoring\(project\_id: UUID\): void

  \- Inicia un watcher cada 10 segundos

  \- Detecta: tareas stuck \(>2x timeout esperado\)

  \- Detecta: agentes en error sin retry

  \- Detecta: proyecto bloqueado \(0 tareas activas pero hay pendientes\)

getProjectDashboard\(project\_id: UUID\): Promise<Dashboard>

  Dashboard incluye:

  \- progress\_pct, tareas por estado

  \- tiempo transcurrido y estimado restante

  \- agentes activos ahora mismo

  \- últimas 5 acciones completadas

  \- coste en tokens/USD hasta ahora

detectBottlenecks\(project\_id: UUID\): Promise<Bottleneck\[\]>

  \- Tarea con más dependientes bloqueados = cuello de botella

  \- Agente con peor performance en proyecto actual

  \- Tool con más errores en últimas 24h

handleAgentFailure\(agent\_id: UUID, task\_id: UUID\): Promise<void>

  \- Si fallo transitorio \(timeout, rate limit\): retry en 30s

  \- Si fallo permanente \(error lógico\): reassign a otro agente

  \- Si 3 agentes distintos fallan en misma tarea: escalar a Jarvis

  \- Jarvis notifica al usuario si necesita intervención

sendProgressUpdate\(project\_id: UUID\): Promise<void>

  \- Envía update por Telegram cada 25% de progreso

  \- Formato: '🟡 Proyecto X: 50% completado\. Analizando datos\.\.\.'

M6  __Learning Engine__

La memoria que hace a Jarvis cada vez mejor

El módulo más estratégico\. Analiza cada proyecto terminado, extrae aprendizajes, crea plantillas reutilizables y mejora continuamente las decisiones de Jarvis en proyectos futuros\.

// PROMPT PARA ANTIGRAVITY — M6: Learning Engine

// Archivo: /office/jarvis/phase3/learning\-engine\.ts

Crea el módulo Learning Engine con estas funciones:

learnFromProject\(project\_id: UUID\): Promise<void>

  Ejecutar después de cada proyecto completado:

  1\. Analizar qué tareas tardaron más de lo esperado

  2\. Identificar qué combinaciones de agente\+tool funcionaron mejor

  3\. Detectar errores repetidos y crear reglas para evitarlos

  4\. Si success\_rate > 85%: crear ProjectTemplate en BD

  5\. Guardar 3\-5 aprendizajes clave en knowledge\_base

saveKnowledge\(category, title, content, tags\): Promise<void>

  Categorías: fact | process | preference | mistake | optimization

getRelevantKnowledge\(context: string, limit=5\): Promise<Knowledge\[\]>

  \- Busca en knowledge\_base por relevancia semántica o tags

  \- Jarvis la llama al planificar CADA nuevo proyecto

  \- Incrementa used\_count de los resultados devueltos

createTemplate\(project: Project\): Promise<ProjectTemplate>

  \- Extrae estructura de tareas del proyecto exitoso

  \- Generaliza los parámetros específicos \(URLs, nombres, etc\.\)

  \- Guarda trigger\_words para detección automática

improveAgentPrompts\(role: string\): Promise<string>

  \- Analiza los últimos 20 proyectos con agentes de ese rol

  \- Identifica patrones de éxito en sus system prompts

  \- Sugiere mejoras al system prompt del rol

weeklyReport\(\): Promise<LearningReport>

  \- Métricas de la semana: proyectos, tasa éxito, coste total

  \- Top 3 aprendizajes más usados

  \- Recomendaciones de mejora para la próxima semana

# __5\. Prompt Maestro de Fase 3 para Antigravity__

Pega este prompt completo en Antigravity para que implemente toda la Fase 3 de una vez\. Jarvis debe tener la Fase 2 operativa antes de ejecutar esto\.

__PRE\-REQUISITO__

La Fase 2 debe estar completamente funcional y las 11 verificaciones del checklist deben estar en verde antes de empezar la Fase 3\.

// PROMPT MAESTRO — FASE 3 COMPLETA

// Pegar en Antigravity en modo Plan primero, luego ejecutar

CONTEXTO:

Tengo una Oficina de IA con Antigravity \+ Supabase\.

Jarvis es mi agente principal ya operativo\.

La Fase 2 \(8 tools\) está completamente implementada y testeada\.

Modelos disponibles: GPT\-4o, Gemini Pro, Gemini Flash\.

OBJETIVO: Implementar la Fase 3 — Sistema de Tareas Autónomo\.

PASO 1: Ejecuta este SQL en Supabase \(6 tablas \+ 2 funciones\):

\[pegar SQL completo de la Sección 3 de este documento\]

PASO 2: Crea los 6 módulos en /office/jarvis/phase3/

en este orden estricto:

  M1: task\-decomposer\.ts

  M2: agent\-spawner\.ts

  M3: task\-queue\.ts

  M4: project\-manager\.ts

  M5: progress\-tracker\.ts

  M6: learning\-engine\.ts

PASO 3: Actualiza /office/jarvis/index\.ts

Para que Jarvis use ProjectManager como punto de entrada:

  \- Cuando recibe un objetivo → createProject\(\) \+ runProject\(\)

  \- Cuando recibe una pregunta de estado → getProjectStatus\(\)

  \- Notificaciones de progreso a Telegram del owner

PASO 4: Crea el orquestador /office/jarvis/phase3/index\.ts

Que conecte todos los módulos y exponga:

  executeObjective\(text: string\): Promise<ProjectResult>

REGLAS:

  \- Todo TypeScript con tipos estrictos

  \- Máximo 5 agentes en paralelo simultáneamente

  \- Notificar al usuario en Telegram en: inicio, 50%, fin, error

  \- Timeout de proyecto: 30 min \(configurable por proyecto\)

  \- Guardar TODO en Supabase para observabilidad completa

  \- Tests de integración: crear un proyecto de prueba end\-to\-end

TEST FINAL:

  Ejecuta este objetivo: 'Busca las 3 principales noticias de IA

  de hoy y envíame un resumen por Telegram'

  Debe crear proyecto, descomponerlo, ejecutar agentes,

  y mandarme el resultado\. Sin intervención manual\.

# __6\. Checklist de Verificación — Fase 3__

__\#__

__Verificación__

__Módulo__

__Estado__

__1__

SQL ejecutado: 6 tablas \+ 2 funciones creadas en Supabase

SQL

⬜ Pendiente

__2__

Task Decomposer convierte texto en 3\-10 tareas JSON válidas

M1

⬜ Pendiente

__3__

Templates reutilizados cuando el objetivo es similar a uno anterior

M1

⬜ Pendiente

__4__

Agent Spawner crea agente con modelo correcto según task\.model\_hint

M2

⬜ Pendiente

__5__

Agentes idle son reutilizados en lugar de crear nuevos

M2

⬜ Pendiente

__6__

Task Queue respeta dependencias \(tarea B no arranca si A no terminó\)

M3

⬜ Pendiente

__7__

Máximo 5 tareas en paralelo \(nunca 6 simultáneas\)

M3

⬜ Pendiente

__8__

Retry automático en fallo transitorio \(hasta max\_retries\)

M3

⬜ Pendiente

__9__

Project Manager ejecuta proyecto completo end\-to\-end sin intervención

M4

⬜ Pendiente

__10__

Outputs de tareas anteriores se inyectan como contexto a las siguientes

M4

⬜ Pendiente

__11__

Progress Tracker detecta tarea stuck y reasigna agente

M5

⬜ Pendiente

__12__

Notificaciones Telegram en: inicio, 50%, 100%, error crítico

M5

⬜ Pendiente

__13__

Learning Engine guarda template tras proyecto con >85% éxito

M6

⬜ Pendiente

__14__

knowledge\_base consultada al planificar nuevo proyecto

M6

⬜ Pendiente

__15__

TEST FINAL: objetivo real → resultado en Telegram sin tocar nada

Todos

⬜ Pendiente

__SIGUIENTE PASO — FASE 4__

Con la Fase 3 completa, la oficina ya puede ejecutar proyectos autónomos\. La Fase 4 añade Control de Costes y Seguridad: presupuestos por agente, router inteligente de modelos según coste/calidad, y audit log completo de todo lo que hace Jarvis\.

