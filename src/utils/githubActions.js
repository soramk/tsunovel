/**
 * GitHub APIを使用してWorkflowをトリガーし、結果をポーリングするユーティリティ
 */

/**
 * GitHubのリポジトリにrepository_dispatchイベントを送信する
 */
export async function triggerFetch(ncode, config) {
    const { owner, repo, pat } = config;
    const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            event_type: 'fetch-novel',
            client_payload: { ncode }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub API error: ${response.status}`);
    }

    return true;
}

/**
 * 生成されたファイルをポーリングして取得する
 */
export async function pollData(ncode, config) {
    const { owner, repo, pat } = config;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/storage/${ncode}/info.json`;

    const fetchOptions = pat ? {
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Accept': 'application/vnd.github.v3.raw',
        }
    } : {};

    const maxRetries = 24; // 24 * 5s = 120s (2 minutes)
    let retries = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const response = await fetch(url, fetchOptions);

                if (response.ok) {
                    const text = await response.text();
                    try {
                        const data = JSON.parse(text);
                        resolve(data);
                        return;
                    } catch (e) {
                        console.error('Failed to parse polled JSON:', e);
                    }
                }

                if (response.status === 404) {
                    retries++;
                    if (retries >= maxRetries) {
                        reject(new Error('Timeout: Novel data not found in repository.'));
                        return;
                    }
                    console.log(`Polling... attempt ${retries}/${maxRetries}`);
                    setTimeout(poll, 5000);
                } else {
                    reject(new Error(`Fetch error: ${response.statusText}`));
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

/**
 * 保存済みの小説一覧（storage/index.json）を取得する
 */
export async function fetchIndex(config) {
    const { owner, repo } = config;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/storage/index.json`;

    const fetchOptions = config.pat ? {
        headers: {
            'Authorization': `Bearer ${config.pat}`,
            'Accept': 'application/vnd.github.v3.raw',
        }
    } : {};

    try {
        const response = await fetch(url, fetchOptions);
        if (response.ok) {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse index JSON:', e);
                return []; // JSONパース失敗時は空配列（形式エラーとして扱う）
            }
        } else {
            console.error(`Fetch Index Error: ${response.status} ${response.statusText}`);
            if (response.status === 401) console.error('Check if your PAT is valid.');
            if (response.status === 404) console.error('storage/index.json not found in the repository.');
            return null; // HTTPエラー時は null を返す
        }
    } catch (error) {
        console.error('Network Error fetching index:', error);
        return null; // ネットワークエラーも null
    }
}

