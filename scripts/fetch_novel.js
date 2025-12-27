const fs = require('fs');
const path = require('path');
const https = require('https');

async function fetchNovel() {
    const ncode = process.env.NCODE;
    if (!ncode) {
        console.error('Error: NCODE environment variable is not set.');
        process.exit(1);
    }

    const url = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${ncode}&gzip=5`;
    const userAgent = 'TsunovelBot/1.0 (GitHub Actions)';

    console.log(`Fetching novel data for ncode: ${ncode}`);

    try {
        const response = await new Promise((resolve, reject) => {
            https.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        const jsonData = JSON.parse(response);
        if (!jsonData || jsonData.length === 0) {
            throw new Error('Novel data not found or invalid response.');
        }

        const dirPath = path.join('docs', ncode);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, 'info.json');
        fs.writeFileSync(filePath, JSON.stringify(jsonData[0], null, 2));

        console.log(`Successfully saved novel data to ${filePath}`);
    } catch (error) {
        console.error('Error fetching novel data:', error.message);
        process.exit(1);
    }
}

fetchNovel();
