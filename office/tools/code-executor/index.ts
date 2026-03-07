import { createClient } from '@supabase/supabase-js';
import { VM } from 'vm2';
import { spawn } from 'child_process';
import crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import os from 'os';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface ExecResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    duration_ms: number;
    timed_out: boolean;
}

function getHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

export async function executeCode(
    language: 'javascript' | 'python',
    code: string,
    timeoutMs: number = 30000,
    agentId: string = 'system'
): Promise<ExecResult> {
    const maxTimeout = Math.min(timeoutMs, 60000); // hard limit 60s
    let result: ExecResult;

    if (language === 'javascript') {
        result = await executeJavascript(code, maxTimeout);
    } else if (language === 'python') {
        result = await executePython(code, maxTimeout);
    } else {
        throw new Error(`Lenguaje no soportado: ${language}`);
    }

    // Guardar en Supabase
    try {
        await supabase.from('code_executions').insert({
            agent_id: agentId,
            language,
            code_hash: getHash(code),
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            duration_ms: result.duration_ms,
            timed_out: result.timed_out
        });
    } catch (err) {
        console.error('Error guardando en code_executions:', err);
    }

    return result;
}

async function executeJavascript(code: string, timeoutMs: number): Promise<ExecResult> {
    const startTime = Date.now();

    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];

    const vm = new VM({
        timeout: timeoutMs,
        sandbox: {},
        eval: false,
        wasm: false
    });

    // Interceptar la consola
    vm.freeze({
        log: (...args: any[]) => stdoutLogs.push(args.join(' ')),
        error: (...args: any[]) => stderrLogs.push(args.join(' ')),
        warn: (...args: any[]) => stderrLogs.push(args.join(' '))
    }, 'console');

    try {
        vm.run(code);
        return {
            stdout: stdoutLogs.join('\n'),
            stderr: stderrLogs.join('\n'),
            exit_code: 0,
            duration_ms: Date.now() - startTime,
            timed_out: false
        };
    } catch (err: any) {
        const isTimeout = err.message === 'Script execution timed out.';
        return {
            stdout: stdoutLogs.join('\n'),
            stderr: stderrLogs.join('\n') + (stderrLogs.length ? '\n' : '') + err.toString(),
            exit_code: 1,
            duration_ms: Date.now() - startTime,
            timed_out: isTimeout
        };
    }
}

async function executePython(code: string, timeoutMs: number): Promise<ExecResult> {
    const startTime = Date.now();

    // Create temporary sandbox dir in OS temp directory
    const sandboxDir = path.join(os.tmpdir(), '.sandbox', Date.now().toString());
    await fs.mkdir(sandboxDir, { recursive: true });

    const scriptPath = path.join(sandboxDir, 'script.py');
    await fs.writeFile(scriptPath, code);

    return new Promise((resolve) => {
        // Basic sandboxing attempt for Python via subprocess.
        const py = spawn('python', [scriptPath], {
            cwd: sandboxDir,
            timeout: timeoutMs
        });

        let stdout = '';
        let stderr = '';

        py.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        py.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        py.on('error', (err) => {
            resolve({
                stdout,
                stderr: stderr + '\n' + err.toString(),
                exit_code: -1,
                duration_ms: Date.now() - startTime,
                timed_out: false
            });
        });

        py.on('close', async (code, signal) => {
            // Cleanup
            await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => { });

            const timedOut = signal === 'SIGTERM' || signal === 'SIGKILL';

            resolve({
                stdout,
                stderr,
                exit_code: code || (timedOut ? 1 : 0),
                duration_ms: Date.now() - startTime,
                timed_out: timedOut
            });
        });
    });
}

export async function installDependency(language: 'javascript' | 'python', pkg: string): Promise<void> {
    throw new Error("La instalación dinámica de dependencias está bloqueada en sandbox estricto de Jarvis.");
}
