export * from './types';
export * from './task-decomposer';
export * from './agent-spawner';
export * from './task-queue';
export * from './project-manager';
export * from './progress-tracker';
export * from './learning-engine';

import { createProject, runProject, getProjectStatus } from './project-manager';
import { startMonitoring } from './progress-tracker';

/**
 * Función principal para iniciar la maquinaria de la Fase 3.
 * Jarvis llamará a esto cuando reciba una instrucción que requiera múltiples pasos.
 */
export async function executeObjective(objective: string): Promise<string> {
    const project = await createProject(objective);
    console.log(`[Phase 3] Proyecto Creado: ${project.id} - ${project.title}`);

    // Inicia el loop de orquestación
    startProjectExecutionLoop(project.id);

    // Inicia la monitorización (cuellos de botella y alertas)
    startMonitoring(project.id);

    return project.id;
}

function startProjectExecutionLoop(project_id: string): void {
    const executeInterval = setInterval(async () => {
        try {
            const status = await getProjectStatus(project_id);
            if (status === 'completed' || status === 'failed') {
                clearInterval(executeInterval);
                console.log(`[Phase 3] Loop de proyecto finalizado: ${project_id}`);
                return;
            }

            if (status === 'running') {
                await runProject(project_id);
            }
        } catch (err: any) {
            console.error(`[Phase 3] Error en loop del proyecto ${project_id}:`, err);
        }
    }, 3000); // Check cada 3 segundos como dicta la documentación
}
