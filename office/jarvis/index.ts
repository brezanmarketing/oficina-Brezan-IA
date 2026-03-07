import { executeObjective, getProjectStatus } from './phase3/index';

/**
 * JarvisCore: El controlador central de las capacidades autónomas de la oficina.
 */
export const JarvisCore = {
    /** 
     * Punto de entrada principal para Jarvis Fase 3.
     * Transforma un objetivo en lenguaje natural a un proyecto autónomo orquestado.
     */
    receiveObjective: async (objectiveText: string) => {
        console.log(`[Jarvis] Recibiendo objetivo: "${objectiveText}"`);
        const projectId = await executeObjective(objectiveText);
        return {
            status: 'accepted',
            message: 'El proyecto ha sido iniciado. Se notificará el progreso.',
            projectId
        };
    },

    /**
     * Consulta el estado en tiempo real de un proyecto en curso.
     */
    checkStatus: async (projectId: string) => {
        const status = await getProjectStatus(projectId);
        return { projectId, status };
    }
};
