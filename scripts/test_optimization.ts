
async function benchmark() {
    console.log('--- Start Benchmark ---');

    console.log('Call 1 (Initialization/Normal)...');
    const start1 = Date.now();
    const res1 = await fetch('http://localhost:3001/status').then(r => r.json()).catch(e => ({ error: e.message }));
    console.log(`Call 1 (Network: ${Date.now() - start1}ms, API Internal: ${res1.durationMs}ms).`);
    console.log('Call 1 _debug:', JSON.stringify(res1._debug, null, 2));

    console.log('\nCall 2 (Should trigger "Already healthy" optimization)...');
    const start2 = Date.now();
    const res2 = await fetch('http://localhost:3001/status').then(r => r.json()).catch(e => ({ error: e.message }));
    console.log(`Call 2 (Network: ${Date.now() - start2}ms, API Internal: ${res2.durationMs}ms).`);
    console.log('Call 2 _debug:', JSON.stringify(res2._debug, null, 2));

    if (res2.durationMs < 500) {
        console.log('\nSUCCESS: Optimization verified. Second call was nearly instant.');
    } else {
        console.log('\nFAILURE: Second call took longer than expected.');
    }
}

benchmark();
