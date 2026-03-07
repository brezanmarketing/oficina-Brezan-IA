import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;

export function getSupabaseService() {
    if (_supabase) return _supabase;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // Durante el build de Next.js, estas pueden no estar disponibles
        // Devolvemos un proxy o simplemente manejamos el error si se intenta usar
        console.warn('Supabase credentials missing during initialization. This is expected during build phase if no operations are performed.');
        return null;
    }

    _supabase = createClient(supabaseUrl, supabaseKey);
    return _supabase;
}
