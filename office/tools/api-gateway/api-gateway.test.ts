import { apiCall, ApiCallConfig } from './index';

async function runTests() {
    console.log('--- Iniciando Tests de API Gateway ---');

    // Test 1: GET Exitoso
    console.log('\\n[1] Probando GET exitoso a API pública (JSONPlaceholder)...');
    const res1 = await apiCall({
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        method: 'GET',
        toolName: 'test-api-gateway'
    });
    console.assert(res1.success === true, 'Test 1 Falló: No es success = true');
    console.assert(res1.data?.id === 1, 'Test 1 Falló: ID no es 1');
    console.log('✅ Test 1 Pasó:', res1.data.title);

    // Test 2: Error 404 (No Retry)
    console.log('\\n[2] Probando error 404...');
    const res2 = await apiCall({
        url: 'https://jsonplaceholder.typicode.com/todos/invalid/404',
        method: 'GET',
        toolName: 'test-api-gateway'
    });
    console.assert(res2.success === false, 'Test 2 Falló: status success');
    console.assert(res2.error?.includes('404'), 'Test 2 Falló: Error message no dice 404');
    console.log('✅ Test 2 Pasó:', res2.error);

    // Test 3: Retry on 503
    // Since we don't have a guaranteed 503 endpoint, we test a domain that doesn't exist to simulate network error retry
    console.log('\\n[3] Probando retries en dominio inexistente (simulando 503/error de red)...');
    const start3 = Date.now();
    const res3 = await apiCall({
        url: 'https://este-dominio-no-existe-nunca-123.com',
        method: 'GET',
        retries: 2, // Intentara 3 veces: inicial (0) + 2 retries = 3 total
        toolName: 'test-api-gateway'
    });
    const duration3 = Date.now() - start3;
    console.assert(res3.success === false, 'Test 3 Falló');
    // Retries: 1s + 2s = 3s total de espera artificial + tiempo de error de red
    console.assert(duration3 > 2500, 'Test 3 Falló: Retries fueron muy rápidos, no hizo backoff');
    console.log('✅ Test 3 Pasó en', duration3, 'ms:', res3.error);

    // Test 4: Timeout configurable
    console.log('\\n[4] Probando timeout configurado a 1ms...');
    const res4 = await apiCall({
        url: 'https://jsonplaceholder.typicode.com/photos',
        method: 'GET',
        timeoutMs: 1, // 1 ms is impossible
        retries: 0,
        toolName: 'test-api-gateway'
    });
    console.assert(res4.success === false, 'Test 4 Falló');
    console.assert(res4.error?.includes('Timeout'), 'Test 4 Falló: Error no fue Timeout');
    console.log('✅ Test 4 Pasó:', res4.error);

    console.log('\\n--- Todos los tests locales completados ---');
}

runTests().catch(console.error);
