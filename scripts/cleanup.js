import { execSync } from 'child_process';

/**
 * Cleanup script to ensure a fresh environment for the Jupiter Agent.
 * Clears port 3001 and kills orphaned chrome processes.
 */

async function cleanup() {
    console.log('--- STARTING CLEANUP SEQUENCE ---');

    // 1. Clear Port 3001
    try {
        console.log('Checking port 3001...');
        const netstat = execSync('netstat -ano | findstr :3001').toString();
        const lines = netstat.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 4) {
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
                    console.log(`Killing process ${pid} blocking port 3001...`);
                    try {
                        execSync(`taskkill /F /PID ${pid}`);
                    } catch (e) {
                        // Might already be dead
                    }
                }
            }
        }
    } catch (e) {
        console.log('Port 3001 is already clear.');
    }

    // 2. Kill Orphaned Chrome/Playwright Processes
    // We target chrome processes that might be lingering from previous sessions.
    // Caution: This kills ALL chrome instances if not careful. 
    // In this specific environment, we target chrome.exe for cleanup.
    try {
        console.log('Cleaning up orphaned browser processes...');
        // We look for chrome.exe specifically. 
        // Note: For a more surgical approach, we could check for user-data-dir in command line,
        // but taskkill /F /IM chrome.exe is the "nuclear" robust option the user requested.
        execSync('taskkill /F /IM chrome.exe /T').catch(() => {});
        execSync('taskkill /F /IM msedge.exe /T').catch(() => {});
    } catch (e) {
        // No processes found
    }

    console.log('--- CLEANUP COMPLETE ---');
}

cleanup();
