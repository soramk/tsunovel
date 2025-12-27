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

        // 本文（全話）の取得
        const chaptersPath = path.join(dirPath, 'chapters');
        if (!fs.existsSync(chaptersPath)) {
            fs.mkdirSync(chaptersPath, { recursive: true });
        }

        const totalChapters = novelInfo.noveltype === 2 ? 1 : (novelInfo.general_allcount || 1);
        console.log(`Starting to fetch ${totalChapters} chapters...`);

        for (let i = 1; i <= totalChapters; i++) {
            try {
                const contentUrl = novelInfo.noveltype === 2
                    ? `https://ncode.syosetu.com/${ncode}/`
                    : `https://ncode.syosetu.com/${ncode}/${i}/`;

                console.log(`[${i}/${totalChapters}] Fetching chapter: ${contentUrl}`);

                const html = await new Promise((resolve, reject) => {
                    const req = https.get(contentUrl, { headers: { 'User-Agent': userAgent } }, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => resolve(data));
                    });
                    req.on('error', reject);
                    req.setTimeout(15000, () => {
                        req.destroy();
                        reject(new Error('Request timeout'));
                    });
                });

                const honbunMatch = html.match(/<div id="novel_honbun" class="novel_view">([\s\S]*?)<\/div>/);
                if (honbunMatch && honbunMatch[1]) {
                    let content = honbunMatch[1]
                        .replace(/<p id="L\d+">/g, '')
                        .replace(/<\/p>/g, '\n')
                        .replace(/<br\s*\/?>/g, '\n')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/<[^>]*>/g, '') // 残ったタグを除去
                        .trim();

                    const chapterFile = path.join(chaptersPath, `${i}.txt`);
                    fs.writeFileSync(chapterFile, content);

                    if (i === 1) {
                        fs.writeFileSync(path.join(dirPath, 'content.txt'), content);
                    }
                }

                if (totalChapters > 1) {
                    await new Promise(r => setTimeout(r, 1000)); // 負荷軽減のため1秒待機
                }
            } catch (err) {
                console.error(`Failed to fetch chapter ${i}:`, err.message);
                if (i === 1) throw err;
            }
        }

        // docs/index.json を更新（一覧用）
        const indexPath = path.join('docs', 'index.json');
        let indexData = [];
        if (fs.existsSync(indexPath)) {
            try {
                indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            } catch (e) {
                indexData = [];
            }
        }

        // 既存のncodeがあれば削除して新しいデータを追加
        indexData = indexData.filter(item => item.ncode !== novelInfo.ncode);
        indexData.unshift({
            ncode: novelInfo.ncode,
            title: novelInfo.title,
            writer: novelInfo.writer,
            added_at: new Date().toISOString()
        });

        fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
        console.log(`Updated index file at ${indexPath}`);
    } catch (error) {
        console.error('Error fetching novel data:', error.message);
        process.exit(1);
    }
}

fetchNovel();
