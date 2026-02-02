/**
 * フロントエンドから直接小説情報を取得するユーティリティ
 * バックエンドAPIを使用しない実装
 */

const FETCH_TIMEOUT = 15000; // 15秒タイムアウト

/**
 * タイムアウト付き fetch ヘルパー関数
 * モバイルでバックグラウンド復帰後などネットワークが不安定な状態でハングを防止
 */
const fetchWithTimeout = async (url, options = {}, timeout = FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`リクエストがタイムアウトしました (${timeout / 1000}秒)`);
    }
    throw error;
  }
};
/**
 * URLからncodeを抽出
 */
export function extractNcode(input) {
  if (!input) return null;

  // 改行や区切り文字で分割して処理
  const items = input.split(/[\n\s,]+/).filter(Boolean);
  const ncodes = [];

  for (const item of items) {
    if (!item) continue;

    // 直接Nコードっぽい場合 (n+5〜6文字の英数字)
    if (/^n[a-z0-9]{5,6}$/i.test(item)) {
      ncodes.push(item.toLowerCase());
      continue;
    }

    // ncode.syosetu.com/n1234ab/ の形式
    const match1 = item.match(/ncode\.syosetu\.com\/([a-z0-9]+)/i);
    if (match1) {
      ncodes.push(match1[1].toLowerCase());
      continue;
    }

    // novel18.syosetu.com/n1234ab/ の形式（R18）
    const match2 = item.match(/novel18\.syosetu\.com\/([a-z0-9]+)/i);
    if (match2) {
      ncodes.push(match2[1].toLowerCase());
      continue;
    }

    // その他の形式
    const match3 = item.match(/syosetu\.com\/[^\/]*\/([a-z0-9]+)/i);
    if (match3) {
      ncodes.push(match3[1].toLowerCase());
      continue;
    }

    // より柔軟なマッチング（nで始まる6文字のコード）
    const match4 = item.match(/\/(n[a-z0-9]{5,})\//i);
    if (match4) {
      ncodes.push(match4[1].toLowerCase());
      continue;
    }
  }

  // 重複を削除
  const uniqueNcodes = [...new Set(ncodes)];
  return uniqueNcodes.length > 0 ? uniqueNcodes.join(',') : null;
}

/**
 * 小説家になろうの小説情報を取得
 * 公式APIを使用: https://dev.syosetu.com/man/api/
 */
export async function fetchSyosetuNovel(url) {
  const ncode = extractNcode(url);
  if (!ncode) {
    throw new Error('小説家になろうのURLからncodeを抽出できませんでした');
  }

  // なろう小説APIからメタ情報を取得
  // API仕様: https://dev.syosetu.com/man/api/
  // 取得項目: タイトル(t), 著者(w), あらすじ(s), 初回掲載日(gf), 最終掲載日(gl), ジャンル(g)
  const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&of=t-w-s-gf-gl-g&ncode=${ncode}`;

  try {
    const response = await fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status}`);
    }

    const data = await response.json();

    // APIのレスポンスは配列形式 [0]が作品情報
    if (!data || data.length === 0 || !data[0].title) {
      throw new Error('小説情報が見つかりませんでした');
    }

    const novelData = data[0];

    return {
      title: novelData.title || 'タイトル不明',
      author: novelData.writer || '著者不明',
      site: '小説家になろう',
      content: novelData.story
        ? `【あらすじ】\n\n${novelData.story}\n\n\n※本文は小説家になろうのサイトで直接ご覧ください。\nURL: ${url}`
        : '※本文は小説家になろうのサイトで直接ご覧ください。',
      url: url,
      ncode: ncode,
      story: novelData.story || '',
      genre: novelData.genre || '',
      general_firstup: novelData.general_firstup || '',
      general_lastup: novelData.general_lastup || '',
    };
  } catch (error) {
    // CORSエラーの場合
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      throw new Error('CORSエラー: ブラウザから直接APIにアクセスできません。小説家になろうのAPIはCORSを許可していない可能性があります。');
    }
    throw error;
  }
}

/**
 * カクヨムの小説情報を取得（CORSの問題で直接取得は困難）
 */
export async function fetchKakuyomuNovel(url) {
  // カクヨムはCORSの問題で直接取得できないため、
  // メタ情報のみを返す
  throw new Error('カクヨムは現在サポートされていません。CORSの制限により、ブラウザから直接取得できません。');
}

/**
 * 汎用小説取得（CORSの問題で直接取得は困難）
 */
export async function fetchGenericNovel(url) {
  throw new Error('このサイトは現在サポートされていません。CORSの制限により、ブラウザから直接取得できません。');
}

/**
 * URLから小説サイトを判定してコンテンツを取得
 */
export async function fetchNovelContent(url) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  // 小説家になろう
  if (hostname.includes('syosetu.com') || hostname.includes('ncode.syosetu.com')) {
    return await fetchSyosetuNovel(url);
  }

  // カクヨム
  if (hostname.includes('kakuyomu.jp')) {
    return await fetchKakuyomuNovel(url);
  }

  // その他のサイト
  return await fetchGenericNovel(url);
}

/**
 * なろう小説APIを使用して検索を行う (JSONPを使用)
 * @param {string} word 検索キーワード
 * @param {number} limit 取得件数
 */
export async function searchNarou(word, limit = 10) {
  if (!word.trim()) return [];

  return new Promise((resolve, reject) => {
    const callbackName = `narou_callback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement('script');

    // なろう小説API JSONP用URL
    // of: t=title, w=writer, s=story, n=ncode
    const url = `https://api.syosetu.com/novelapi/api/?out=jsonp&of=t-w-s-n&lim=${limit}&word=${encodeURIComponent(word)}&callback=${callbackName}`;

    window[callbackName] = (data) => {
      delete window[callbackName];
      document.body.removeChild(script);

      if (!data || !Array.isArray(data)) {
        resolve([]);
        return;
      }

      // 最初のエントリは項目数なので除外
      const results = data.slice(1).map(item => ({
        title: item.title,
        author: item.writer,
        desc: item.story,
        ncode: item.ncode.toLowerCase(),
        site: '小説家になろう'
      }));

      resolve(results);
    };

    script.onerror = () => {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('検索リクエストに失敗しました'));
    };

    script.src = url;
    document.body.appendChild(script);
  });
}
