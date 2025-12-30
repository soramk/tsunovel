const fs = require('fs');
const path = require('path');

/**
 * なろう小説削除スクリプト
 * - storage/index.json からエントリを削除
 * - storage/[ncode] ディレクトリを削除
 */
async function removeNovel() {
    const ncode = (process.env.NCODE || '').trim().toLowerCase();
    if (!ncode) {
        console.error('Error: NCODE environment variable is not set.');
        process.exit(1);
    }

    console.log(`--- Start Removing Novel: ${ncode} ---`);

    try {
        // 1. storage/index.json から削除
        const indexPath = path.join('storage', 'index.json');
        if (fs.existsSync(indexPath)) {
            let indexData = [];
            try {
                indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
                const originalCount = indexData.length;
                indexData = indexData.filter(item => item.ncode.toLowerCase() !== ncode);

                if (indexData.length < originalCount) {
                    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
                    console.log(`Removed ${ncode} from index.json`);
                } else {
                    console.log(`${ncode} not found in index.json`);
                }
            } catch (e) {
                console.error('Failed to parse index.json:', e.message);
            }
        }

        // 2. storage/[ncode] ディレクトリを削除
        const dirPath = path.join('storage', ncode);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`Deleted directory: ${dirPath}`);
        } else {
            console.log(`Directory not found: ${dirPath}`);
        }

        console.log(`--- Successfully Removed Novel: ${ncode} ---`);
    } catch (error) {
        console.error('--- Fatal Error ---');
        console.error(error.message);
        process.exit(1);
    }
}

removeNovel();
