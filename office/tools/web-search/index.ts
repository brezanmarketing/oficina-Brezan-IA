import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { apiCall, getCredential } from '../api-gateway/index';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
    published_at?: string;
    position: number;
}

export interface ImageResult {
    title: string;
    url: string;
    source: string;
}

function getHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function getCached(hash: string): Promise<any | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('search_cache')
        .select('*')
        .eq('query_hash', hash)
        .single();

    if (error || !data) return null;

    if (new Date(data.expires_at).getTime() < Date.now()) {
        // Expirado
        return null;
    }
    return data.results_json;
}

async function saveCache(hash: string, text: string, type: string, results: any[], source: string, ttlMinutes: number) {
    const supabase = getSupabase();
    const expires = new Date(Date.now() + ttlMinutes * 60000).toISOString();
    await supabase.from('search_cache').upsert({
        query_hash: hash,
        query_text: `[${type}] ${text}`,
        results_json: results,
        source,
        result_count: results.length,
        expires_at: expires
    }, { onConflict: 'query_hash' });
}

export async function searchWeb(query: string, options?: any): Promise<SearchResult[]> {
    const hash = getHash('web:' + query);
    const cached = await getCached(hash);
    if (cached) return cached;

    // Intentar Serper
    try {
        const res = await apiCall({
            url: 'https://google.serper.dev/search',
            method: 'POST',
            body: { q: query },
            auth: {
                type: 'api-key',
                integration_id: 'serper',
                key_name: 'API Key',
                header_name: 'X-API-KEY'
            },
            toolName: 'web-search-serper'
        });

        if (res.success && res.data) {
            const results: SearchResult[] = (res.data.organic || []).map((item: any) => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                source: 'serper',
                position: item.position
            }));
            await saveCache(hash, query, 'web', results, 'serper', 60);
            return results;
        }
    } catch (e) {
        console.warn('Serper falló, intentando fallback...', e);
    }

    // Fallback: Tavily (Si estuviésemos conectados)
    try {
        const res = await apiCall({
            url: 'https://api.tavily.com/search',
            method: 'POST',
            body: { query: query, search_depth: 'basic' },
            auth: {
                type: 'api-key',
                integration_id: 'tavily',
                key_name: 'API Key',
                header_name: 'api-key' // O equivalente, dependiendo de la API de Tavily
            },
            toolName: 'web-search-tavily'
        });

        if (res.success && res.data) {
            const results: SearchResult[] = (res.data.results || []).map((item: any, idx: number) => ({
                title: item.title,
                url: item.url,
                snippet: item.content,
                source: 'tavily',
                position: idx + 1
            }));
            await saveCache(hash, query, 'web', results, 'tavily', 60);
            return results;
        }
    } catch (e) {
        console.error('Tavily también falló.', e);
    }

    return [];
}

export async function searchNews(query: string, options?: any): Promise<SearchResult[]> {
    const hash = getHash('news:' + query);
    const cached = await getCached(hash);
    if (cached) return cached;

    const res = await apiCall({
        url: 'https://google.serper.dev/news',
        method: 'POST',
        body: { q: query },
        auth: {
            type: 'api-key',
            integration_id: 'serper',
            key_name: 'API Key',
            header_name: 'X-API-KEY'
        },
        toolName: 'web-search-news'
    });

    if (res.success && res.data) {
        const results: SearchResult[] = (res.data.news || []).map((item: any, idx: number) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            source: item.source || 'serper-news',
            published_at: item.date,
            position: idx + 1
        }));
        await saveCache(hash, query, 'news', results, 'serper', 15);
        return results;
    }
    return [];
}

export async function searchImages(query: string, options?: any): Promise<ImageResult[]> {
    const hash = getHash('images:' + query);
    const cached = await getCached(hash);
    if (cached) return cached;

    const res = await apiCall({
        url: 'https://google.serper.dev/images',
        method: 'POST',
        body: { q: query },
        auth: {
            type: 'api-key',
            integration_id: 'serper',
            key_name: 'API Key',
            header_name: 'X-API-KEY'
        },
        toolName: 'web-search-images'
    });

    if (res.success && res.data) {
        const results: ImageResult[] = (res.data.images || []).map((item: any) => ({
            title: item.title,
            url: item.imageUrl,
            source: item.source || 'serper-images'
        }));
        await saveCache(hash, query, 'images', results, 'serper', 60);
        return results;
    }
    return [];
}
