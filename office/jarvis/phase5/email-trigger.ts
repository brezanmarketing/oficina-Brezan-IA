import { createClient } from '@supabase/supabase-js';
import { executeJarvisObjective } from './core-executor';

// Mocks simulando un integrador de Email como Nodemailer, Gmail API o Resend
const emailManager: any = {
    readInbox: async (opts: any) => {
        // En un caso real: obtener correos no leídos vía IMAP/API
        console.log('[EmailManager] Buscando nuevos correos...', opts);
        return [];
    },
    replyToEmail: async (threadId: string, template: string) => {
        console.log(`[EmailManager] Respondiendo al hilo ${threadId}: ${template}`);
    },
    applyLabel: async (emailId: string, label: string) => {
        console.log(`[EmailManager] Etiquetando ${emailId} como ${label}`);
    }
}

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

let lastCheck = new Date(); // InMemory para este worker

export async function processIncomingEmails() {
    console.log('[Email Trigger] Revisando bandeja de entrada...');

    // 1. Leer emails
    const emails = await emailManager.readInbox({
        limit: 20,
        unread_only: true,
        since: lastCheck
    });

    if (emails.length === 0) {
        lastCheck = new Date();
        return { processed: 0 };
    }

    // 2. Cargar triggers de email activos
    const { data: triggers, error } = await getSupabase()
        .from('email_triggers')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching email triggers:", error);
        return { processed: 0 };
    }
    if (!triggers || triggers.length === 0) return { processed: 0 };

    let processedCount = 0;

    // 3. Evaluar regex
    for (const email of emails) {
        let matched = false;

        for (const trigger of triggers) {
            if (matchesEmailTrigger(email, trigger)) {

                const objective = String(trigger.objective)
                    .replace('{from}', email.from)
                    .replace('{subject}', email.subject)
                    .replace('{body}', email.body_preview || email.body);

                // 4. Ejecutar objetivo
                const result = await executeJarvisObjective(
                    objective,
                    'email_trigger',
                    { email_id: email.id, trigger_id: trigger.id }
                );

                // 5. Auto responder
                if (trigger.auto_reply && trigger.reply_template) {
                    await emailManager.replyToEmail(
                        email.thread_id,
                        trigger.reply_template.replace('{name}', email.from_name || email.from)
                    );
                }

                await emailManager.applyLabel(email.id, 'Procesado-Jarvis');

                // Actualizar DB
                await getSupabase().from('email_triggers')
                    .update({ trigger_count: (trigger.trigger_count || 0) + 1 })
                    .eq('id', trigger.id);

                await logTriggerExecution(trigger.id, 'email', trigger.name, { email_id: email.id }, 'success', result);

                matched = true;
                processedCount++;
                break; // Un trigger por correo máximo para evitar procesamientos duplicados si matchean varios
            }
        }

        if (!matched) {
            await emailManager.applyLabel(email.id, 'Ignorado-Jarvis');
        }
    }

    lastCheck = new Date();
    return { processed: processedCount };
}

function matchesEmailTrigger(email: any, trigger: any): boolean {
    try {
        if (trigger.match_from && !new RegExp(trigger.match_from, 'i').test(email.from)) return false;
        if (trigger.match_subject && !new RegExp(trigger.match_subject, 'i').test(email.subject)) return false;
        if (trigger.match_body && !new RegExp(trigger.match_body, 'i').test(email.body)) return false;
        return true;
    } catch {
        // En caso de Regex invalido
        return false;
    }
}

export async function logTriggerExecution(triggerId: string, type: string, name: string, input: any, status: 'success' | 'failed' | 'skipped', result: any) {
    await getSupabase().from('trigger_executions').insert({
        trigger_id: triggerId,
        trigger_type: type,
        trigger_name: name,
        input_data: input,
        status: status,
        result: result
    });
}
