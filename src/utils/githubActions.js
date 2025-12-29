/**
 * GitHub APIを使用してWorkflowをトリガーし、結果をポーリングするユーティリティ
 */

/**
 * GitHubのリポジトリにrepository_dispatchイベントを送信する
 */
export async function triggerFetch(ncode, config, type = 'full', episodes = '') {
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
            client_payload: {
                ncode,
                type,
                episodes
            }
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
    const ncodeLower = ncode.toLowerCase();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/storage/${ncodeLower}/info.json`;

    const fetchOptions = pat ? {
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Accept': 'application/vnd.github.v3.raw',
        }
    } : {};

    const maxRetries = 480; // 480 * 5s = 2400s (40 minutes)
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

    console.log('--- Fetch Index Debug ---');
    console.log('URL:', url);
    console.log('PAT set:', !!config.pat);

    try {
        const response = await fetch(url, fetchOptions);
        console.log('Response Status:', response.status, response.statusText);

        if (response.ok) {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                console.log('Successfully fetched index with', data.length, 'items');
                return data;
            } catch (e) {
                console.error('Failed to parse index JSON:', e);
                console.log('Raw text received:', text.substring(0, 100) + '...');
                return [];
            }
        } else {
            console.error(`Fetch Index Error Details:`);
            console.error(`Status: ${response.status}`);
            console.error(`StatusText: ${response.statusText}`);
            if (response.status === 401) console.error('Authentication failed. Check your PAT scopes (repo scope required).');
            if (response.status === 404) console.error('Path not found. Please verify "storage/index.json" exists on main branch.');
            if (response.status === 403) console.error('Rate limit exceeded or forbidden access.');
            return null;
        }
    } catch (error) {
        console.error('Network Error during fetchIndex:', error);
        return null;
    }
}

