const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

/**
 * なろう小説取得スクリプト v2
 * - APIでメタデータを取得
 * - HTMLスクレイピングで本文を取得 (gzip対応, Browser-like UA)
 */
async function fetchNovel() {
    const ncode = process.env.NCODE;
    if (!ncode) {
        console.error('Error: NCODE environment variable is not set.');
        process.exit(1);
    }

    // ブラウザに近いUser-Agentに設定
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    console.log(`--- Start Fetching: ${ncode} ---`);

    try {
        // 1. メタデータの取得 (なろうAPI)
        const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${ncode}`;
        console.log('Fetching metadata from API...');
        const apiResponse = await httpRequest(apiUrl, { 'User-Agent': userAgent });

        let jsonData;
        try {
            jsonData = JSON.parse(apiResponse);
        } catch (e) {
            console.error('API Response Parse Error. Raw:', apiResponse.substring(0, 200));
            throw e;
        }

        if (!jsonData || jsonData.length < 2) {
            throw new Error('Novel not found in Narou API.');
        }

        const novelInfo = jsonData[1];
        const dirPath = path.join('storage', ncode);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(path.join(dirPath, 'info.json'), JSON.stringify(novelInfo, null, 2));
        console.log(`Saved metadata to ${dirPath}/info.json`);

        // 2. 本文の取得 (スクレイピング)
        const chaptersPath = path.join(dirPath, 'chapters');
        if (!fs.existsSync(chaptersPath)) fs.mkdirSync(chaptersPath, { recursive: true });

        const totalChapters = novelInfo.noveltype === 2 ? 1 : (novelInfo.general_allcount || 1);
        console.log(`Total episodes target: ${totalChapters}`);

        for (let i = 1; i <= totalChapters; i++) {
            const contentUrl = novelInfo.noveltype === 2
                ? `https://ncode.syosetu.com/${ncode}/`
                : `https://ncode.syosetu.com/${ncode}/${i}/`;

            console.log(`[${i}/${totalChapters}] Fetching: ${contentUrl}`);

            try {
                const html = await httpRequest(contentUrl, {
                    'User-Agent': userAgent,
                    'Cookie': 'over18=yes',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate'
                });

                // 本文抽出 (新旧レイアウト対応)
                const honbunPatterns = [
                    /<div id="novel_honbun"[^>]*>([\s\S]*?)<\/div>/i,
                    /<div class="[^"]*p-novel__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
                    /<div[^>]+js-novel-text[^>]*>([\s\S]*?)<\/div>/i
                ];

                let honbunMatch = null;
                for (const pattern of honbunPatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        honbunMatch = match;
                        break;
                    }
                }

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

                    fs.writeFileSync(path.join(chaptersPath, `${i}.txt`), content);
                    if (i === 1) fs.writeFileSync(path.join(dirPath, 'content.txt'), content);
                    console.log(`[${i}/${totalChapters}] SUCCESS. (${content.length} chars)`);
                } else {
                    console.error(`[${i}/${totalChapters}] FAILED to find content marker.`);
                    console.log('HTML Snippet (first 500 chars):', html.substring(0, 500));
                    if (html.includes('霞草')) console.log('Detected: Anti-Bot or Age Verification Page.');
                }
            } catch (err) {
                console.error(`[${i}/${totalChapters}] HTTP Error:`, err.message);
                if (i === 1) throw err; // 1話目がダメなら終了
            }

            // 負荷軽減
            if (totalChapters > 1) await new Promise(r => setTimeout(r, 1000));
        }

        // 3. インデックスの更新
        updateIndex(novelInfo);
        console.log('--- All Process Completed ---');

    } catch (error) {
        console.error('--- Fatal Error ---');
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * リクエスト関数
 */
function httpRequest(url, headers) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // リダイレクト対応
                console.log(`Following redirect to: ${res.headers.location}`);
                return httpRequest(res.headers.location, headers).then(resolve).catch(reject);
            }

            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                const encoding = res.headers['content-encoding'];

                if (encoding === 'gzip') {
                    zlib.gunzip(buffer, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(decoded.toString());
                    });
                } else if (encoding === 'deflate') {
                    zlib.inflate(buffer, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(decoded.toString());
                    });
                } else {
                    resolve(buffer.toString());
                }
            });
        }).on('error', reject).setTimeout(20000, function () {
            this.destroy();
            reject(new Error('HTTP Timeout (20s)'));
        });
    });
}

/**
 * インデックスファイルの更新
 */
function updateIndex(novelInfo) {
    const indexPath = path.join('storage', 'index.json');
    let indexData = [];
    if (fs.existsSync(indexPath)) {
        try {
            indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        } catch (e) { }
    }

    indexData = indexData.filter(item => item.ncode !== novelInfo.ncode);
    indexData.unshift({
        ncode: novelInfo.ncode,
        title: novelInfo.title,
        writer: novelInfo.writer,
        added_at: new Date().toISOString(),
        total_episodes: novelInfo.general_allcount
    });

    fs.writeFileSync(indexPath, JSON.stringify(indexData.slice(0, 100), null, 2));
}

fetchNovel();
