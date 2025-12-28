const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

/**
 * なろう小説取得スクリプト v2.1
 * - APIでメタデータを取得
 * - HTMLスクレイピングで本文を取得 (gzip対応, Browser-like UA)
 * - 前書き・本文・後書きを正しく分離して取得
 */
async function fetchNovel() {
    const ncodeRaw = process.env.NCODE;
    if (!ncodeRaw) {
        console.error('Error: NCODE environment variable is not set.');
        process.exit(1);
    }
    const ncode = ncodeRaw.toLowerCase();
    const fetchType = process.env.FETCH_TYPE || 'full'; // 'full', 'specific', 'new'
    const episodesInput = process.env.EPISODES || '';

    // ブラウザに近いUser-Agentに設定
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    console.log(`--- Start Fetching: ${ncode} (Type: ${fetchType}, Episodes: ${episodesInput}) ---`);

    try {
        // 1. メタデータの取得 (なろうAPI)
        const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${ncode}`;
        console.log('Fetching metadata from API...');
        const apiResponse = await httpRequestWithRetry(apiUrl, { 'User-Agent': userAgent });

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

        const totalChapters = novelInfo.novel_type === 2 ? 1 : (novelInfo.general_all_no || 1);
        console.log(`Total episodes available: ${totalChapters}`);

        // 取得対象エピソードの決定
        let targetEpisodes = [];
        if (fetchType === 'specific' && episodesInput) {
            targetEpisodes = episodesInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0 && n <= totalChapters);
        } else if (fetchType === 'new') {
            for (let i = 1; i <= totalChapters; i++) {
                if (!fs.existsSync(path.join(chaptersPath, `${i}.txt`))) {
                    targetEpisodes.push(i);
                }
            }
            if (targetEpisodes.length === 0) {
                console.log('No new episodes to fetch.');
            }
        } else {
            // default to 'full'
            for (let i = 1; i <= totalChapters; i++) {
                targetEpisodes.push(i);
            }
        }

        console.log(`Target episodes count: ${targetEpisodes.length}`);

        for (const i of targetEpisodes) {
            const contentUrl = novelInfo.novel_type === 2
                ? `https://ncode.syosetu.com/${ncode}/`
                : `https://ncode.syosetu.com/${ncode}/${i}/`;

            console.log(`[${i}/${totalChapters}] Fetching: ${contentUrl}`);

            try {
                const html = await httpRequestWithRetry(contentUrl, {
                    'User-Agent': userAgent,
                    'Cookie': 'over18=yes',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate'
                });

                // --- 抽出ロジック開始 ---

                // 1. タイトル抽出
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

                // 2. 各セクションの抽出
                const textBlocks = {
                    preface: "",
                    body: "",
                    afterword: ""
                };

                // 新レイアウト (.p-novel__text) の抽出
                const blockRegex = /<div[^>]+class="[^"]*p-novel__text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
                let m;
                while ((m = blockRegex.exec(html)) !== null) {
                    const tag = m[0];
                    const content = m[1];
                    if (tag.includes('p-novel__text--preface')) {
                        textBlocks.preface += content + "\n";
                    } else if (tag.includes('p-novel__text--afterword')) {
                        textBlocks.afterword += content + "\n";
                    } else {
                        // モディファイアなしは本文
                        textBlocks.body += content + "\n";
                    }
                }

                // 旧レイアウト (IDベース) の抽出 (見つからなかった場合の補完)
                if (!textBlocks.preface) {
                    const legacy = html.match(/<div id="novel_p"[^>]*>([\s\S]*?)<\/div>/i);
                    if (legacy) textBlocks.preface = legacy[1];
                }
                if (!textBlocks.body) {
                    const legacy = html.match(/<div id="novel_honbun"[^>]*>([\s\S]*?)<\/div>/i);
                    if (legacy) textBlocks.body = legacy[1];
                }
                if (!textBlocks.afterword) {
                    const legacy = html.match(/<div id="novel_a"[^>]*>([\s\S]*?)<\/div>/i);
                    if (legacy) textBlocks.afterword = legacy[1];
                }

                // 3. コンテンツの結合とクリーンアップ
                let combinedContent = "";
                if (chapterTitle) combinedContent += `■ ${chapterTitle}\n\n`;

                const sections = ['preface', 'body', 'afterword'];
                let foundAny = false;

                for (const section of sections) {
                    let raw = textBlocks[section];
                    if (raw) {
                        let text = raw
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
                            combinedContent += text + "\n\n";
                            foundAny = true;
                        }
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
                // --- 抽出ロジック終了 ---

            } catch (err) {
                console.error(`[${i}/${totalChapters}] HTTP Error:`, err.message);
                if (i === 1) throw err;
            }

            // 負荷軽減
            if (targetEpisodes.length > 1) await new Promise(r => setTimeout(r, 1000));
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
 * リトライ機能付きリクエスト
 */
async function httpRequestWithRetry(url, headers, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await httpRequest(url, headers);
        } catch (err) {
            const isLast = i === retries - 1;
            const waitTime = i === 0 ? 2000 : 5000;
            console.error(`Request failed (Attempt ${i + 1}/${retries}): ${err.message}`);
            if (isLast) throw err;
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}

/**
 * リクエスト関数
 */
function httpRequest(url, headers) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: headers,
            timeout: 60000 // 60s
        };
        https.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // リダイレクト対応
                console.log(`Following redirect to: ${res.headers.location}`);
                return httpRequest(res.headers.location, headers).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP Error: ${res.statusCode}`));
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
        }).on('error', reject).on('timeout', function () {
            this.destroy();
            reject(new Error('HTTP Timeout (60s)'));
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
