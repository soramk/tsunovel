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

        // なろうAPIのフィールド名修正: novel_type, general_all_no
        const totalChapters = novelInfo.novel_type === 2 ? 1 : (novelInfo.general_all_no || 1);
        console.log(`Total episodes target: ${totalChapters}`);

        for (let i = 1; i <= totalChapters; i++) {
            const contentUrl = novelInfo.novel_type === 2
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

                // タイトル抽出
                const titlePatterns = [
                    /<h1 class="[^"]*p-novel__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
                    /<p class="novel_subtitle"[^>]*>([\s\S]*?)<\/p>/i
                ];
                let chapterTitle = "";
                for (const pattern of titlePatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        chapterTitle = match[1].trim();
                        break;
                    }
                }

                // 各セクションの抽出
                const sections = [
                    { name: 'Preface', patterns: [/<div[^>]+p-novel__text--preface[^>]*>([\s\S]*?)<\/div>/i, /<div id="novel_p"[^>]*>([\s\S]*?)<\/div>/i] },
                    { name: 'Body', patterns: [/<div id="novel_honbun"[^>]*>([\s\S]*?)<\/div>/i, /<div class="[^"]*p-novel__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i, /<div[^>]+js-novel-text[^>]*>([\s\S]*?)<\/div>/i] },
                    { name: 'Afterword', patterns: [/<div[^>]+p-novel__text--afterword[^>]*>([\s\S]*?)<\/div>/i, /<div id="novel_a"[^>]*>([\s\S]*?)<\/div>/i] }
                ];

                let combinedContent = "";
                if (chapterTitle) {
                    combinedContent += `■ ${chapterTitle}\n\n`;
                }

                let foundAny = false;
                for (const section of sections) {
                    let sectionContent = "";
                    for (const pattern of section.patterns) {
                        const match = html.match(pattern);
                        // 本文(Body)の場合は、クラス名によるマッチング時に preface/afterword を含まないものを優先したいが、
                        // 現状の regex では最初に見つかったものを採用する。
                        // 新レイアウトでは .p-novel__body の中に .p-novel__text が複数ある場合がある。
                        if (match && match[1]) {
                            // 抽出したHTMLからタグを除去してテキスト化
                            let text = match[1]
                                .replace(/<p id="L[pa]?\d+">/g, '')
                                .replace(/<\/p>/g, '\n')
                                .replace(/<br\s*\/?>/g, '\n')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&amp;/g, '&')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .replace(/<[^>]*>/g, '')
                                .trim();

                            if (text) {
                                sectionContent = text;
                                break;
                            }
                        }
                    }
                    if (sectionContent) {
                        combinedContent += sectionContent + "\n\n";
                        foundAny = true;
                    }
                }

                if (foundAny) {
                    const finalContent = combinedContent.trim();
                    fs.writeFileSync(path.join(chaptersPath, `${i}.txt`), finalContent);
                    if (i === 1) fs.writeFileSync(path.join(dirPath, 'content.txt'), finalContent);
                    console.log(`[${i}/${totalChapters}] SUCCESS. (${finalContent.length} chars)`);
                } else {
                    console.error(`[${i}/${totalChapters}] FAILED to find any content sections.`);
                    console.log('HTML Snippet (first 500 chars):', html.substring(0, 500));
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
        total_episodes: novelInfo.general_all_no
    });

    fs.writeFileSync(indexPath, JSON.stringify(indexData.slice(0, 100), null, 2));
}

fetchNovel();
