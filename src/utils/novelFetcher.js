/**
 * フロントエンドから直接小説情報を取得するユーティリティ
 * バックエンドAPIを使用しない実装
 */

/**
 * URLからncodeを抽出
 */
export function extractNcode(url) {
  // ncode.syosetu.com/n1234ab/ の形式
  const match1 = url.match(/ncode\.syosetu\.com\/([a-z0-9]+)/i);
  if (match1) return match1[1].toLowerCase();
  
  // novel18.syosetu.com/n1234ab/ の形式（R18）
  const match2 = url.match(/novel18\.syosetu\.com\/([a-z0-9]+)/i);
  if (match2) return match2[1].toLowerCase();
  
  // その他の形式
  const match3 = url.match(/syosetu\.com\/[^\/]*\/([a-z0-9]+)/i);
  if (match3) return match3[1].toLowerCase();
  
  // より柔軟なマッチング（nで始まる6文字のコード）
  const match4 = url.match(/\/(n[a-z0-9]{5,})\//i);
  if (match4) return match4[1].toLowerCase();
  
  return null;
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
    const response = await fetch(apiUrl, {
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

