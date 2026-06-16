import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const EXTENSION_ID = 'bfnaoagmocialkpmbeihdgbhnbmbiibm';
// Try a slightly different URL that often works better
const DOWNLOAD_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=98.0&acceptformat=crx2,crx3&x=id%3D${EXTENSION_ID}%26uc`;
const OUTPUT_DIR = path.resolve('extensions/phantom');
const CRX_FILE = path.resolve('extensions/phantom.crx');

function get(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                console.log('Following redirect to:', res.headers.location);
                get(res.headers.location!).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(CRX_FILE);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        if (!fs.existsSync('extensions')) fs.mkdirSync('extensions');
        await get(DOWNLOAD_URL);
        console.log('Download complete.');

        const buffer = fs.readFileSync(CRX_FILE);
        console.log('File size:', buffer.length);

        const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
        const headerOffset = buffer.indexOf(zipHeader);

        if (headerOffset === -1) {
            console.error('Could not find ZIP header in CRX file.');
            // Let's print the first 50 bytes to see what it is
            console.log('Header preview:', buffer.subarray(0, 100).toString('hex'));
            return;
        }

        console.log('ZIP header found at offset:', headerOffset);
        const zipBuffer = buffer.subarray(headerOffset);
        const ZIP_FILE = path.resolve('extensions/phantom.zip');
        fs.writeFileSync(ZIP_FILE, zipBuffer);

        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        execSync(`powershell.exe -Command "Expand-Archive -Path '${ZIP_FILE}' -DestinationPath '${OUTPUT_DIR}' -Force"`);
        console.log('Extraction complete.');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
