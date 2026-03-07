'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, SharedContext, Agent } from '@/lib/types'

// ─── Tipos internos ───────────────────────────────────────────────────────────
type AgentAction = { command: string; params: Record<string, string> }

export function useOrchestrator(agents: Agent[], activeProjectId?: string | null) {
  const supabase = createClient()

  // Refs para evitar referencias circulares entre runAgent y executeActions
  const runAgentRef = useRef<(agent: Agent, task: Task, promptText: string, consultationResults?: { agentName: string; agentRole: string; result: string }[]) => Promise<void>>(async () => { })
  const executeActionsRef = useRef<(actions: AgentAction[], executingAgent: Agent, originTask?: Task, originalPrompt?: string) => Promise<void>>(async () => { })

  // ─── Directiva Empresarial y de Proyecto ──────────────────────────────
  const [companyDirective, setCompanyDirective] = useState<string>('')
  const [projectDirective, setProjectDirective] = useState<string>('')

  useEffect(() => {
    // Cargar la directiva empresarial desde system_settings
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'company_directive')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          setCompanyDirective(typeof data.value === 'string' ? data.value : JSON.stringify(data.value))
        }
      })
  }, [supabase])

  useEffect(() => {
    if (activeProjectId) {
      supabase.from('projects').select('directive').eq('id', activeProjectId).single().then(({ data }) => {
        if (data?.directive) setProjectDirective(data.directive)
        else setProjectDirective('')
      })
    } else {
      setProjectDirective('')
    }
  }, [activeProjectId, supabase])

  // Ejecuta a un agente usando el endpoint LLM
  // consultationResults: resultados de consultas previas a otros agentes (para re-ejecuciones)
  const runAgent = useCallback(async (
    agent: Agent,
    task: Task,
    promptText: string,
    consultationResults?: { agentName: string; agentRole: string; result: string }[]
  ) => {
    // Set to working (por si estaba en thinking)
    await supabase.from('agents').update({ status: 'working' }).eq('id', agent.id)

    // ─── Directorio del Equipo: se inyecta en el prompt para que el agente sepa con quién puede colaborar
    const teamDirectory = agents
      .filter(a => a.id !== agent.id)
      .map(a => `- ${a.name} (${a.role}) | Status: ${a.employment_status || 'active'} | Desempeño: ${a.performance_score || 100}/100 | ID="${a.id}"`)
      .join('\n')

    const teamContext = agents.length > 1
      ? `\n\n---\n## DIRECTORIO DEL EQUIPO (Tus Compañeros)\nPuedes consultar a estos expertos usando la acción ASK_AGENT:\n${teamDirectory}\n---\n`
      : ''

    // Si hay resultados de consultas previas, los añadimos al contexto
    const consultationContext = consultationResults && consultationResults.length > 0
      ? `\n\n---\n## RESULTADOS DE CONSULTA CON EXPERTOS\n${consultationResults.map(c => `### ${c.agentName} (${c.agentRole}) respondió:\n${c.result}`).join('\n\n')}\n---\n\nCon esta información de tus compañeros, ahora completa tu tarea.`
      : ''

    // ─── Directiva Empresarial o de Proyecto: contexto estratégico
    const directiveContext = projectDirective
      ? `\n\n---\n## DIRECTIVA DE ESTE PROYECTO TÁCTICO (WAR ROOM COMPARTIDA)\n${projectDirective}\nPrioriza esta directiva táctica y usa la acción ASSIGN_TEAM para armar el equipo si es necesario.\n---\n`
      : companyDirective
        ? `\n\n---\n## DIRECTIVA ESTRATÉGICA DE LA EMPRESA (CONTEXTO OBLIGATORIO)\n${companyDirective}\n---\n`
        : ''

    const enrichedPrompt = promptText + teamContext + directiveContext + consultationContext

    try {
      console.log(`Corriendo Agente ${agent.name}...`)
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          modelType: agent.model_type,
          systemPrompt: agent.system_prompt,
          prompt: enrichedPrompt,
          taskId: task.id
        })
      })
      const data = await res.json()

      // ─── Ejecutar acciones autónomas ────────────────────────────────────
      if (data.actions && data.actions.length > 0) {
        await executeActionsRef.current(data.actions, agent, task, promptText)
      }

      await supabase.from('agents').update({ status: 'idle' }).eq('id', agent.id)

      if (data.error) throw new Error(data.error)

      await supabase.from('shared_context').insert({
        task_id: task.id,
        sender_agent_id: agent.id,
        data: { result: data.result }
      })
    } catch (err) {
      console.error('Error al ejecutar agente:', err)
      await supabase.from('agents').update({ status: 'idle' }).eq('id', agent.id)
    }
  }, [supabase, agents])

  // Sincronizar el ref con el valor actual del callback
  runAgentRef.current = runAgent

  // ─── Ejecutor de Acciones Autónomas ────────────────────────────────────────
  const executeActions = useCallback(async (
    actions: AgentAction[],
    executingAgent: Agent,
    originTask?: Task,
    originalPrompt?: string
  ) => {
    const consultationResults: { agentName: string; agentRole: string; result: string }[] = []

    for (const action of actions) {
      console.log(`[AUTONOMY] Ejecutando acción: ${action.command}`, action.params)

      // ─── ASK_AGENT: Consultar a un experto del equipo ────────────────────
      if (action.command === 'ASK_AGENT') {
        const { agent_name, question } = action.params
        if (!agent_name || !question) {
          console.warn('[AUTONOMY] ASK_AGENT: faltan parámetros (agent_name, question).')
          continue
        }

        // Buscar al agente experto por nombre (búsqueda flexible)
        const expertAgent = agents.find(
          a => a.name.toLowerCase().includes(agent_name.toLowerCase()) && a.id !== executingAgent.id
        )
        if (!expertAgent) {
          console.warn(`[AUTONOMY] ASK_AGENT: no se encontró al agente '${agent_name}'`)
          consultationResults.push({
            agentName: agent_name,
            agentRole: 'Desconocido',
            result: `(Agente '${agent_name}' no encontrado en el equipo)`
          })
          continue
        }

        console.log(`[AUTONOMY] ${executingAgent.name} consulta a ${expertAgent.name}...`)

        // Marcar al experto como 'thinking' / colaborando
        await supabase.from('agents').update({
          status: 'thinking',
          collaboration_with: executingAgent.id
        }).eq('id', expertAgent.id)
        await supabase.from('agents').update({
          collaboration_with: expertAgent.id
        }).eq('id', executingAgent.id)

        // Ejecutar al agente experto con la pregunta
        const consultRes = await fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: expertAgent.id,
            modelType: expertAgent.model_type,
            systemPrompt: expertAgent.system_prompt,
            prompt: `${executingAgent.name} te consulta:\n\n${question}\n\nResponde con tu mejor criterio experto. Sé detallado y concreto.`,
            taskId: originTask?.id
          })
        })
        const consultData = await consultRes.json()
        const expertResult = consultData.result || '(sin respuesta)'

        // Limpiar colaboración del experto
        await supabase.from('agents').update({
          status: 'idle',
          collaboration_with: null
        }).eq('id', expertAgent.id)

        consultationResults.push({
          agentName: expertAgent.name,
          agentRole: expertAgent.role,
          result: expertResult
        })

        console.log(`[AUTONOMY] ✅ ${expertAgent.name} respondió a ${executingAgent.name}`)
      }

      // ─── CREATE_AGENT: EXCLUSIVO de J.A.R.V.I.S. ──────────────────────
      else if (action.command === 'CREATE_AGENT') {
        // Guardia de seguridad: solo Jarvis tiene autoridad para contratar
        const isJarvis =
          executingAgent.name.toLowerCase().includes('jarvis') ||
          executingAgent.role.toLowerCase().includes('mano derecha') ||
          executingAgent.role.toLowerCase().includes('director') ||
          executingAgent.role.toLowerCase().includes('cso')

        if (!isJarvis) {
          console.warn(`[AUTONOMY] 🚫 CREATE_AGENT bloqueado. '${executingAgent.name}' no tiene permisos para contratar. Solo J.A.R.V.I.S. puede hacerlo.`)
          continue
        }

        const { name, role, model, prompt: agentPrompt, reason } = action.params
        if (!name || !role || !agentPrompt) {
          console.warn('[AUTONOMY] CREATE_AGENT: faltan parámetros (name, role, prompt).')
          continue
        }

        // Icono aleatorio de un set predefinido
        const icons = ['cpu', 'brain', 'zap', 'globe', 'shield', 'lightbulb', 'code', 'database', 'layers']
        const gradients = [
          'from-emerald-500 to-teal-600',
          'from-orange-500 to-red-600',
          'from-blue-500 to-cyan-600',
          'from-violet-500 to-purple-600',
          'from-rose-500 to-pink-600'
        ]
        const randomIcon = icons[Math.floor(Math.random() * icons.length)]
        const randomGradient = gradients[Math.floor(Math.random() * gradients.length)]

        const { data: newAgent, error } = await supabase.from('agents').insert({
          name: name.trim(),
          role: role.trim(),
          model_type: model || 'Gemini-Flash',
          system_prompt: agentPrompt.trim(),
          status: 'idle',
          creation_reason: reason || 'Decisión ejecutiva',
          employment_status: 'active',
          performance_score: 100,
          avatar_config: { icon: randomIcon, gradient: randomGradient }
        }).select().single()

        if (error) {
          console.error('[AUTONOMY] Error creando agente:', error)
        } else {
          console.log(`[AUTONOMY] ✅ Nuevo agente '${name}' creado por ${executingAgent.name}!`, newAgent)

          if (newAgent && activeProjectId) {
            await supabase.from('project_agents').insert({
              project_id: activeProjectId,
              agent_id: newAgent.id
            })
          }

          await supabase.from('shared_context').insert({
            task_id: null,
            sender_agent_id: executingAgent.id,
            data: {
              event: 'AGENT_CREATED',
              message: `${executingAgent.name} ha contratado a un nuevo trabajador: ${name} (${role}). Motivo: ${reason || 'Estrategia interna'}.`,
              new_agent_id: newAgent?.id
            }
          })
        }
      }

      // ─── ASSIGN_TEAM: EXCLUSIVO de J.A.R.V.I.S. en WAR ROOMS ──────────────
      else if (action.command === 'ASSIGN_TEAM') {
        const isJarvis =
          executingAgent.name.toLowerCase().includes('jarvis') ||
          executingAgent.role.toLowerCase().includes('mano derecha')

        if (!isJarvis) {
          console.warn(`[AUTONOMY] 🚫 ASSIGN_TEAM bloqueado. Solo J.A.R.V.I.S. puede asignar equipos.`)
          continue
        }

        if (!activeProjectId) {
          console.warn('[AUTONOMY] ASSIGN_TEAM: no hay un proyecto activo.')
          continue
        }

        const agentsStr = action.params.agents
        if (!agentsStr) continue

        const agentNames = agentsStr.split(',').map(n => n.trim().toLowerCase())
        const agentsToAssign = agents.filter(a => agentNames.some(n => a.name.toLowerCase().includes(n)))

        if (agentsToAssign.length > 0) {
          const inserts = agentsToAssign.map(a => ({
            project_id: activeProjectId,
            agent_id: a.id
          }))
          const { error } = await supabase.from('project_agents').upsert(inserts, { onConflict: 'project_id, agent_id' })
          if (error) console.error('[AUTONOMY] Error asignando equipo:', error)
          else {
            console.log(`[AUTONOMY] ✅ J.A.R.V.I.S asignó al equipo: ${agentsToAssign.map(a => a.name).join(', ')}`)
            await supabase.from('shared_context').insert({
              task_id: null,
              sender_agent_id: executingAgent.id,
              data: {
                event: 'TEAM_ASSIGNED',
                message: `${executingAgent.name} ha ensamblado el equipo: ${agentsToAssign.map(a => a.name).join(', ')}.`
              }
            })
          }
        }
      }

      // ─── UPDATE_DIRECTIVE: Actualizar la Directiva Empresarial ──────────
      else if (action.command === 'UPDATE_DIRECTIVE') {
        // Guardia: solo Jarvis puede modificar la directiva
        const isJarvis =
          executingAgent.name.toLowerCase().includes('jarvis') ||
          executingAgent.role.toLowerCase().includes('mano derecha') ||
          executingAgent.role.toLowerCase().includes('director') ||
          executingAgent.role.toLowerCase().includes('cso')

        if (!isJarvis) {
          console.warn(`[AUTONOMY] 🚫 UPDATE_DIRECTIVE bloqueado. '${executingAgent.name}' no tiene permisos.`)
          continue
        }

        const { content } = action.params
        if (!content) {
          console.warn('[AUTONOMY] UPDATE_DIRECTIVE: falta el parámetro "content".')
          continue
        }

        const { error: directiveError } = await supabase
          .from('system_settings')
          .upsert({ key: 'company_directive', value: content.trim() })

        if (directiveError) {
          console.error('[AUTONOMY] Error actualizando directiva:', directiveError)
        } else {
          console.log('[AUTONOMY] ✅ Directiva empresarial actualizada por', executingAgent.name)
          await supabase.from('shared_context').insert({
            task_id: null,
            sender_agent_id: executingAgent.id,
            data: {
              event: 'DIRECTIVE_UPDATED',
              message: `${executingAgent.name} ha actualizado la Directiva Empresarial.`
            }
          })
        }
      }

      // ─── NUEVAS HERRAMIENTAS: MEMORIA Y REFLEXIÓN ────────────────────────

      // EVALUATE_TEAM
      else if (action.command === 'EVALUATE_TEAM') {
        const isJarvis = executingAgent.role.toLowerCase().includes('director') || executingAgent.name.toLowerCase().includes('jarvis') || executingAgent.role.toLowerCase().includes('cso') || executingAgent.role.toLowerCase().includes('mano derecha')
        if (!isJarvis) continue

        // Construir métricas del equipo usando la vista agent_cost_summary si existe, 
        // o construyendo a mano para asegurar funcionamiento.
        const { data: usageData } = await supabase.from('token_usage').select('agent_id, input_tokens, output_tokens, cost_usd')

        const statsByAgent = (usageData || []).reduce((acc: any, curr: any) => {
          if (!acc[curr.agent_id]) acc[curr.agent_id] = { cost: 0, calls: 0 }
          acc[curr.agent_id].cost += Number(curr.cost_usd || 0)
          acc[curr.agent_id].calls += 1
          return acc
        }, {})

        let evaluationText = "=== REPORTE DE EVALUACIÓN DEL EQUIPO ===\n"
        agents.forEach(a => {
          const stats = statsByAgent[a.id] || { cost: 0, calls: 0 }
          evaluationText += `- ${a.name} (${a.role}) | Status: ${a.employment_status || 'active'} | Desempeño: ${a.performance_score || 100}/100 | Llamadas: ${stats.calls} | Costo Acumulado: $${stats.cost.toFixed(4)}\n`
        })

        // Devolver los resultados a Jarvis mediante consultationResults
        consultationResults.push({
          agentName: 'System Auditor',
          agentRole: 'Internal',
          result: evaluationText
        })
        console.log(`[AUTONOMY] ✅ EVALUATE_TEAM ejecutado por ${executingAgent.name}`)
      }

      // UPDATE_AGENT_EMPLOYMENT
      else if (action.command === 'UPDATE_AGENT_EMPLOYMENT') {
        const isJarvis = executingAgent.role.toLowerCase().includes('director') || executingAgent.name.toLowerCase().includes('jarvis') || executingAgent.role.toLowerCase().includes('cso') || executingAgent.role.toLowerCase().includes('mano derecha')
        if (!isJarvis) continue

        const { agent_name, new_status, reason } = action.params
        if (!agent_name || !new_status || !reason) continue

        const targetAgent = agents.find(a => a.name.toLowerCase().includes(agent_name.toLowerCase()))
        if (targetAgent) {
          await supabase.from('agents').update({ employment_status: new_status }).eq('id', targetAgent.id)

          await supabase.from('shared_context').insert({
            task_id: null,
            sender_agent_id: executingAgent.id,
            data: {
              event: 'AGENT_STATUS_UPDATED',
              message: `${executingAgent.name} ha cambiado el estado de ${targetAgent.name} a '${new_status}'. Motivo: ${reason}`
            }
          })
          console.log(`[AUTONOMY] ✅ Estado de ${targetAgent.name} actualizado a ${new_status}`)
        }
      }

      // UPDATE_AGENT_PROMPT
      else if (action.command === 'UPDATE_AGENT_PROMPT') {
        const isJarvis = executingAgent.role.toLowerCase().includes('director') || executingAgent.name.toLowerCase().includes('jarvis') || executingAgent.role.toLowerCase().includes('cso') || executingAgent.role.toLowerCase().includes('mano derecha')
        if (!isJarvis) continue

        const { agent_name, new_prompt } = action.params
        if (!agent_name || !new_prompt) continue

        const targetAgent = agents.find(a => a.name.toLowerCase().includes(agent_name.toLowerCase()))
        if (targetAgent) {
          await supabase.from('agents').update({ system_prompt: new_prompt }).eq('id', targetAgent.id)
          console.log(`[AUTONOMY] ✅ Prompt de ${targetAgent.name} optimizado por ${executingAgent.name}`)
        }
      }

      // ─── CHECK_CREDENTIAL: INTEGRATION VAULT ────────────────────────────
      else if (action.command === 'CHECK_CREDENTIAL') {
        const { integration_id } = action.params
        if (!integration_id) {
          console.warn('[AUTONOMY] CHECK_CREDENTIAL: falta el identificador de la API (integration_id).')
          continue
        }

        const { data: credResult, error: credError } = await supabase.rpc('check_credential', {
          p_integration_id: integration_id
        })

        if (credError) {
          console.error('[AUTONOMY] Error revisando credencial:', credError)
          consultationResults.push({
            agentName: 'Sistema de Seguridad',
            agentRole: 'Vault',
            result: `Error de Vault al tratar de acceder a ${integration_id}. Detalles: ${credError.message}`
          })
        } else if (credResult) {
          const credStatus = typeof credResult === 'string' ? JSON.parse(credResult) : credResult

          if (credStatus.available) {
            console.log(`[AUTONOMY] ✅ Vault confirma que credencial para ${integration_id} EXISTE y está ACTIVA.`)
            // Log usage
            await supabase.from('credential_usage_log').insert({
              integration_id: integration_id,
              agent_id: executingAgent.id,
              agent_name: executingAgent.name,
              action: 'check',
              metadata: { status: 'success' }
            })

            consultationResults.push({
              agentName: 'Sistema de Seguridad',
              agentRole: 'Vault',
              result: `La credencial para ${integration_id} ESTÁ DISPONIBLE y puedes proceder a utilizarla.`
            })
          } else {
            console.log(`[AUTONOMY] 🚫 Vault informa que credencial para ${integration_id} NO EXISTE. Bloqueando acceso.`)
            // Inform everyone and Jarivs
            await supabase.from('shared_context').insert({
              task_id: null,
              sender_agent_id: executingAgent.id,
              data: {
                event: 'CREDENTIAL_REQUIRED',
                message: `Atención Humano: Requiero usar la integración ${integration_id} pero las credenciales no están conectadas en el Panel de API.`,
                requested_integration: integration_id
              }
            })

            // Log usage as failed
            await supabase.from('credential_usage_log').insert({
              integration_id: integration_id,
              agent_id: executingAgent.id,
              agent_name: executingAgent.name,
              action: 'check',
              metadata: { status: 'failed_missing' }
            })

            consultationResults.push({
              agentName: 'Sistema de Seguridad',
              agentRole: 'Vault',
              result: `ACCESO DENEGADO. La credencial para ${integration_id} NO ESTÁ CONECTADA. He notificado al usuario para que la agregue al Panel de Conexiones. NO puedes completar esta acción por ahora.`
            })
          }
        }
      }

    } // Fin del for loop de actions

    // Si hubo consultas a expertos, re-ejecutar al agente original con los resultados
    if (consultationResults.length > 0 && originTask && originalPrompt) {
      console.log(`[AUTONOMY] Re-ejecutando a ${executingAgent.name} con resultados de consultas...`)
      // Usamos un timeout pequeño para no bloquear el hilo actual
      setTimeout(() => {
        runAgentRef.current(executingAgent, originTask, originalPrompt, consultationResults)
      }, 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, agents, activeProjectId])

  // Sincronizar el ref con el valor actual
  executeActionsRef.current = executeActions

  // Maneja el inicio de una misión
  const handleTaskStart = useCallback(async (contextRow: SharedContext) => {
    if (!contextRow.task_id) return
    const { data: taskData } = await supabase.from('tasks').select('*').eq('id', contextRow.task_id).single()
    if (!taskData || !taskData.chain_of_command || taskData.chain_of_command.length === 0) return

    const firstAgentId = taskData.chain_of_command[0]
    const firstAgent = agents.find(a => a.id === firstAgentId)
    if (!firstAgent) return

    const prompt = contextRow.data.prompt || contextRow.data.message || 'Inicia la misión'
    runAgent(firstAgent, taskData as Task, `Misión: ${taskData.title}\nInstrucciones:\n${prompt}`)
  }, [supabase, agents, runAgent])

  // Esta función es el núcleo del Handoff
  const processHandoff = useCallback(async (contextRow: SharedContext) => {
    // 1. Obtener la tarea asociada a este shared_context
    if (!contextRow.task_id) return

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', contextRow.task_id)
      .single()

    if (taskError || !taskData) {
      console.error('Orchestrator: Error al buscar tarea', taskError)
      return
    }

    const task = taskData as Task

    // Si la tarea ya se completó, fue cancelada, o no tiene cadena de mando, no hacemos nada
    if (task.status === 'completed' || task.status === 'cancelled' || !task.chain_of_command || task.chain_of_command.length === 0) {
      return
    }

    // 2. Determinar en qué paso estamos
    // current_step_index indica el agente de la cadena que *debería* estar trabajando
    // o el que acaba de terminar?
    // Asumamos que contextRow trae el resultado del agente index X.
    const chain = task.chain_of_command
    const currentIndex = task.current_step_index || 0

    // Si el current_step_index ya es mayor que la cadena, se acabó
    if (currentIndex >= chain.length) return

    // 3. Verificamos si el sender de este context es el agente actual de la cadena
    const expectedAgentId = chain[currentIndex]

    // NOTA: Para este prototipo, si insertan un context en una cadena activa, avanzamos.
    // En un entorno robusto verificaríamos: contextRow.sender_agent_id === expectedAgentId

    const nextIndex = currentIndex + 1

    // 4. ¿Hay un siguiente agente?
    if (nextIndex < chain.length) {
      const nextAgentId = chain[nextIndex]
      const nextAgent = agents.find(a => a.id === nextAgentId)

      console.log(`Orchestrator: Handoff de paso \${currentIndex} al \${nextIndex} -> Agent ID \${nextAgentId}`)

      // A) Actualizamos la tarea para mover el index al siguiente y asignar al nuevo agente
      await supabase
        .from('tasks')
        .update({
          current_step_index: nextIndex,
          assigned_agent_id: nextAgentId,
          status: 'in_progress'
        })
        .eq('id', task.id)

      // B) Ponemos al nuevo agente a 'thinking'
      await supabase
        .from('agents')
        .update({ status: 'thinking' })
        .eq('id', nextAgentId)

      // C) Opcionalmente, pasamos el "System Instruction"
      // Insertamos *el inicio de la tarea* para el siguiente agente en shared_context (opcional)
      await supabase
        .from('shared_context')
        .insert({
          task_id: task.id,
          sender_agent_id: null, // Mensaje del sistema
          data: {
            event: 'HANDOFF',
            message: `El Cerebro Central ha asignado este paso a ${nextAgent?.name || 'Siguiente Agente'}.`,
            previous_result: contextRow.data
          }
        })

      // D) Correr el siguiente agente!
      if (nextAgent) {
        // Limpiamos colaboración anterior del sender y ponemos la nueva al receiver
        if (contextRow.sender_agent_id) {
          await supabase.from('agents').update({ collaboration_with: nextAgentId }).eq('id', contextRow.sender_agent_id)
        }
        await supabase.from('agents').update({ collaboration_with: contextRow.sender_agent_id || 'System' }).eq('id', nextAgentId)

        const previoInfo = typeof contextRow.data?.result === 'string' ? contextRow.data.result : JSON.stringify(contextRow.data)
        runAgent(nextAgent, task, `Recibes el relevo en la misión "${task.title}".\n\nAquí tienes el resultado del agente anterior:\n\n${previoInfo}\n\nPor favor, continúa la labor desde tu especialidad.`)
      }

    } else {
      // Fin de la cadena
      console.log('Orchestrator: Cadena completada de Tarea:', task.id)

      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          result: JSON.stringify(contextRow.data)
        })
        .eq('id', task.id)

      // Limpiar estados de colaboración de la cadena
      if (chain.length > 0) {
        await supabase.from('agents').update({ collaboration_with: null }).in('id', chain)
      }
    }

  }, [supabase, agents])

  useEffect(() => {
    // Si no hay agentes cargados, no arrancamos el orquestador
    if (agents.length === 0) return

    console.log('Orchestrator: Escuchando el shared_context...')

    // Suscripción al shared_context para activar la lógica de relevo
    const channel = supabase
      .channel('orchestrator')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shared_context' },
        (payload) => {
          const newContext = payload.new as SharedContext

          // Ignoramos eventos de sistema (sender_agent_id nulo) para evitar bucles infinitos
          if (newContext.data?.event === 'TASK_STARTED') {
            handleTaskStart(newContext)
            return
          }

          if (!newContext.sender_agent_id && !newContext.created_by) return
          if (newContext.data?.event === 'HANDOFF') return

          processHandoff(newContext)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, agents, processHandoff, handleTaskStart])
}
