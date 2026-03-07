import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from '../file-manager/index';
import { ToolResult } from '../index';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface PageContent {
    title: string;
    text: string;
    links: string[];
    metadata: any;
    screenshotUrl?: string;
}

export interface FormResult {
    success: boolean;
    message?: string;
}

let activeBrowser: Browser | null = null;
const domainRequests: Record<string, number[]> = {};

async function checkRateLimit(domain: string, maxPerSec: number = 1) {
    const now = Date.now();
    if (!domainRequests[domain]) {
        domainRequests[domain] = [];
    }

    // Clean up older than 1 second
    domainRequests[domain] = domainRequests[domain].filter(t => now - t < 1000);

    if (domainRequests[domain].length >= maxPerSec) {
        const oldest = domainRequests[domain][0];
        const waitTime = oldest + 1000 - now;
        if (waitTime > 0) {
            await new Promise(res => setTimeout(res, waitTime));
        }
    }
    domainRequests[domain].push(Date.now());
}

async function getBrowser(): Promise<Browser> {
    if (!activeBrowser) {
        activeBrowser = await chromium.launch({ headless: true });
    }
    return activeBrowser;
}

async function withPage<T>(url: string, action: (page: Page) => Promise<T>): Promise<T> {
    const domain = new URL(url).hostname;

    // Rate limits & basic domain checks (naive blocklist mechanism)
    const blockedDomains = ['example-blocked.com'];
    if (blockedDomains.includes(domain)) {
        throw new Error(`Dominio bloqueado: ${domain}`);
    }

    await checkRateLimit(domain, 1); // 1 request / sec por dominio

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Jarvis/1.0 (Oficina Brezan IA)' // Identificación clara
    });
    const page = await context.newPage();

    try {
        page.setDefaultTimeout(30000); // 30s timeout
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Check robots.txt could be injected here before navigating or acting.
        // For simplicity in this iteration, assuming manual checks or internal scraping endpoints.

        return await action(page);
    } finally {
        await page.close();
        await context.close();
    }
}

export async function visitPage(url: string, agentId: string = 'system'): Promise<PageContent> {
    const startTime = Date.now();
    try {
        const result = await withPage(url, async (page) => {
            const title = await page.title();

            // Remove scripts and styles for clean text
            await page.evaluate(() => {
                document.querySelectorAll('script, style, noscript, nav, footer, iframe').forEach(el => el.remove());
            });

            const text = await page.evaluate(() => document.body.innerText || '');
            const links = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.startsWith('http'))
            );

            // Meta tags
            const metadata = await page.evaluate(() => {
                const metas: any = {};
                document.querySelectorAll('meta').forEach(el => {
                    if (el.name) metas[el.name] = el.content;
                    if (el.getAttribute('property')) metas[el.getAttribute('property')!] = el.content;
                });
                return metas;
            });

            return { title, text: text.substring(0, 50000), links: links.slice(0, 50), metadata };
        });

        await logInteraction('visitPage', url, agentId, true, startTime);
        return result;
    } catch (error: any) {
        await logInteraction('visitPage', url, agentId, false, startTime, error.message);
        throw error;
    }
}

export async function extractData(url: string, selector: string, agentId: string = 'system'): Promise<any[]> {
    const startTime = Date.now();
    try {
        const result = await withPage(url, async (page) => {
            return await page.evaluate((sel) => {
                return Array.from(document.querySelectorAll(sel)).map(el => el.textContent?.trim());
            }, selector);
        });
        await logInteraction('extractData', url, agentId, true, startTime);
        return result;
    } catch (error: any) {
        await logInteraction('extractData', url, agentId, false, startTime, error.message);
        throw error;
    }
}

export async function fillForm(url: string, fields: Record<string, string>, submitSelector?: string, agentId: string = 'system'): Promise<FormResult> {
    const startTime = Date.now();
    try {
        const result = await withPage(url, async (page) => {
            for (const [selector, value] of Object.entries(fields)) {
                await page.fill(selector, value);
            }
            if (submitSelector) {
                await page.click(submitSelector);
                await page.waitForLoadState('networkidle');
            }
            return { success: true, message: 'Formulario completado correctamente.' };
        });
        await logInteraction('fillForm', url, agentId, true, startTime);
        return result;
    } catch (error: any) {
        await logInteraction('fillForm', url, agentId, false, startTime, error.message);
        return { success: false, message: error.message };
    }
}

export async function clickElement(url: string, selector: string, agentId: string = 'system'): Promise<void> {
    const startTime = Date.now();
    try {
        await withPage(url, async (page) => {
            await page.click(selector);
            await page.waitForLoadState('domcontentloaded');
        });
        await logInteraction('clickElement', url, agentId, true, startTime);
    } catch (error: any) {
        await logInteraction('clickElement', url, agentId, false, startTime, error.message);
        throw error;
    }
}

export async function screenshot(url: string, options?: any, agentId: string = 'system'): Promise<Buffer> {
    const startTime = Date.now();
    try {
        const buffer = await withPage(url, async (page) => {
            return await page.screenshot({ fullPage: options?.fullPage || false });
        });

        // Guardar en File Manager (Supabase)
        const filename = `screenshot_${new URL(url).hostname}_${Date.now()}.png`;
        await writeFile(`screenshots/${filename}`, buffer, { origin: url });

        await logInteraction('screenshot', url, agentId, true, startTime);
        return buffer;
    } catch (error: any) {
        await logInteraction('screenshot', url, agentId, false, startTime, error.message);
        throw error;
    }
}

export async function scrapeStructured(url: string, schema: any, agentId: string = 'system'): Promise<any> {
    // Requires instructing an LLM or specific predefined parsers.
    // As a strict DOM fallback, we could parse basic json-ld.
    const startTime = Date.now();
    try {
        const result = await withPage(url, async (page) => {
            const jsonLd = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                return scripts.map(s => JSON.parse(s.textContent || '{}'));
            });
            return jsonLd.length ? jsonLd[0] : null;
        });
        await logInteraction('scrapeStructured', url, agentId, true, startTime);
        return result;
    } catch (error: any) {
        await logInteraction('scrapeStructured', url, agentId, false, startTime, error.message);
        throw error;
    }
}

async function logInteraction(action: string, url: string, agentId: string, success: boolean, startTime: number, errorMsg?: string) {
    try {
        await supabase.from('tool_executions').insert({
            tool_name: 'web-browser',
            agent_id: agentId,
            input_params: { action, url },
            status: success ? 'success' : 'error',
            error_msg: errorMsg || null,
            duration_ms: Date.now() - startTime
        });
    } catch (e) {
        console.error('Error logging web-browser execution', e);
    }
}
