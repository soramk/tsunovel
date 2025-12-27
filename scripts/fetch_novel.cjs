const fs = require('fs');
const path = require('path');
const https = require('https');

async function fetchNovel() {
    const ncode = process.env.NCODE;
    if (!ncode) {
        console.error('Error: NCODE environment variable is not set.');
        process.exit(1);
    }

    const url = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${ncode}`;
    const userAgent = 'TsunovelBot/1.0 (GitHub Actions)';

    console.log(`Fetching novel data for ncode: ${ncode}`);
    console.log(`URL: ${url}`);

    try {
        const response = await new Promise((resolve, reject) => {
            https.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        console.log('API Response received (first 100 chars):', response.substring(0, 100));

        let jsonData;
        try {
            jsonData = JSON.parse(response);
        } catch (e) {
            console.error('Failed to parse JSON response. Response was:', response);
            throw new Error(`JSON parse error: ${e.message}`);
        }

        if (!jsonData || jsonData.length < 2) {
            console.error('API Response Structure:', jsonData);
            throw new Error('Novel data not found in response (array length < 2).');
        }

        // 最初の要素は {allcount: n} なので、2番目の要素を取得
        const novelInfo = jsonData[1];

        const dirPath = path.join('docs', ncode);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, 'info.json');
        fs.writeFileSync(filePath, JSON.stringify(novelInfo, null, 2));

        console.log(`Successfully saved novel data to ${filePath}`);
    } catch (error) {
        console.error('Error fetching novel data:', error.message);
        process.exit(1);
    }
}

fetchNovel();
