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
    const { owner, repo } = config;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/docs/${ncode}/info.json?t=${Date.now()}`;

    const maxRetries = 24; // 24 * 5s = 120s (2 minutes)
    let retries = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const response = await fetch(url);

                if (response.ok) {
                    const data = await response.json();
                    resolve(data);
                    return;
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
 * 保存済みの小説一覧（docs/index.json）を取得する
 */
export async function fetchIndex(config) {
    const { owner, repo } = config;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/docs/index.json?t=${Date.now()}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error fetching index:', error);
        return [];
    }
}

