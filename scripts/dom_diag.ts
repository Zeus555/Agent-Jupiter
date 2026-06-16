
async function diag() {
    console.log('--- DOM Diagnostic ---');
    const res = await fetch('http://localhost:3001/status').then(r => r.json());
    console.log('Status response:', JSON.stringify(res, null, 2));
    console.log('\n--- Now checking DOM directly ---');

    // We can't directly query the DOM from here, but we can add a temporary endpoint.
    // Instead, let's just look at what we have.
    console.log('The _debug shows connected=false and connecting=true.');
    console.log('This means isWalletConnected returns false and the Connecting text check returns true.');
    console.log('balance=0 SOL means the balance IS extracted, which means the wallet IS connected on the page.');
    console.log('The address regex is not matching, and "Connecting" text exists somewhere.');
}

diag();
