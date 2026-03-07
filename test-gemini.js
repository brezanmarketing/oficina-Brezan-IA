const fs = require('fs');

async function testGemini() {
    // try to load env
    const env = fs.readFileSync('.env.local', 'utf-8');
    const apiKeyMatches = env.match(/GEMINI_API_KEY=(.*)/);
    const key = apiKeyMatches ? apiKeyMatches[1].trim() : null;

    if (!key) throw new Error("No key found");

    const geminiModel = 'gemini-1.5-flash-latest';

    console.log("Calling Gemini API to List Models");

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        {
            method: 'GET'
        }
    );

    const data = await res.json();
    if (data.models) {
        fs.writeFileSync('models.json', JSON.stringify(data.models.map(m => m.name), null, 2));
        console.log("Written to models.json");
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

testGemini().catch(console.error);
