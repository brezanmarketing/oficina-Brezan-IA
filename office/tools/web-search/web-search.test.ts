import { searchWeb, searchNews, searchImages } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de Web Search ---');

    console.log('\\n[1] Probando searchWeb...');
    try {
        const web = await searchWeb('Supabase pricing');
        console.log(`Encontrados ${web.length} resultados web. Primer resultado:`, web[0]?.title);
    } catch (e) {
        console.error('Error en searchWeb:', e);
    }

    console.log('\\n[2] Probando searchNews...');
    try {
        const news = await searchNews('Artificial Intelligence');
        console.log(`Encontrados ${news.length} resultados de noticias. Primer resultado:`, news[0]?.title);
    } catch (e) {
        console.error('Error en searchNews:', e);
    }

    console.log('\\n[3] Probando searchImages...');
    try {
        const images = await searchImages('Cats');
        console.log(`Encontrados ${images.length} resultados de imágenes. Primer resultado:`, images[0]?.title);
    } catch (e) {
        console.error('Error en searchImages:', e);
    }
}

runTests().catch(console.error);
