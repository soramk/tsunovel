const fs = require('fs');
const path = require('path');

const indexPath = path.join('storage', 'index.json');
if (!fs.existsSync(indexPath)) {
    console.error('index.json not found');
    process.exit(1);
}

let index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

index = index.map(item => {
    const infoPath = path.join('storage', item.ncode.toLowerCase(), 'info.json');
    if (fs.existsSync(infoPath)) {
        try {
            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            return {
                ...item,
                genre: info.genre
            };
        } catch (e) {
            console.error(`Error parsing ${infoPath}:`, e);
        }
    }
    return item;
});

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log('Successfully enriched index.json with genre data.');
