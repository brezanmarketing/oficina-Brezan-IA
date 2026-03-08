const { syncCronJobsToCalendar } = require('./office/jarvis/calendar-sync');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function testSync() {
    console.log('--- TEST SYNC ---');
    try {
        await syncCronJobsToCalendar();
        console.log('Sync finished check internal logs above.');
    } catch (e) {
        console.error('CRITICAL SYNC ERROR:', e);
    }
}

testSync();
