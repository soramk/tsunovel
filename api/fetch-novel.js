/**
 * Web小説取得API
 * Vercel Serverless Function
 * 
 * 使用方法:
 * POST /api/fetch-novel
 * Body: { url: "https://..." }
 * 
 * 注意: 実際の実装では、より堅牢なHTMLパーサー（cheerio等）の使用を推奨
 */

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Fetching novel from URL:', url);
    const novelData = await fetchNovelContent(url);
    console.log('Novel data fetched successfully:', {
      title: novelData.title,
      author: novelData.author,
      contentLength: novelData.content?.length || 0
    });
    return res.status(200).json(novelData);
  } catch (error) {
    console.error('Error fetching novel:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to fetch novel',
      message: error.message,
      details: error.stack
    });
  }
}

/**
 * URLから小説サイトを判定してコンテンツを取得
 */
async function fetchNovelContent(url) {
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

  // その他のサイト（汎用パーサー）
  return await fetchGenericNovel(url);
}

/**
 * 小説家になろうの小説を取得
 * 公式APIを使用してメタ情報を取得し、本文はHTMLから取得
 */
async function fetchSyosetuNovel(url) {
  console.log('Fetching Syosetu novel from:', url);
  
  // URLからncodeを抽出
  const ncode = extractNcode(url);
  console.log('Extracted ncode:', ncode);
  
  if (!ncode) {
    throw new Error(`小説家になろうのURLからncodeを抽出できませんでした。URL: ${url}`);
  }

  // なろう小説APIからメタ情報を取得
  // API仕様: https://dev.syosetu.com/man/api/
  const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&of=t-w-s-gf-gl&ncode=${ncode}`;
  console.log('Fetching from API:', apiUrl);
  
  let metaData = null;
  try {
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('API Response status:', apiResponse.status);

    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log('API Data received:', apiData);
      // APIのレスポンスは配列形式 [0]が作品情報
      if (apiData && apiData.length > 0 && apiData[0].title) {
        metaData = apiData[0];
        console.log('Meta data extracted:', { title: metaData.title, writer: metaData.writer });
      } else {
        console.warn('API returned empty or invalid data');
      }
    } else {
      console.warn('API request failed with status:', apiResponse.status);
    }
  } catch (apiError) {
    console.warn('APIからの取得に失敗しました。HTMLから取得を試みます:', apiError.message);
  }

  // 本文を取得するため、HTMLページにアクセス
  // 作品ページのURLを構築（最初の話を取得）
  let novelPageUrl;
  if (url.includes('/n') && !url.match(/\/\d+\/$/)) {
    // URLが作品ページでない場合、最初の話のURLを構築
    novelPageUrl = url.replace(/\/$/, '') + '/1/';
  } else if (url.match(/\/\d+\/$/)) {
    // 既に特定の話のURLの場合、そのまま使用
    novelPageUrl = url;
  } else {
    // デフォルトで最初の話
    novelPageUrl = `https://ncode.syosetu.com/${ncode}/1/`;
  }
  
  console.log('Fetching HTML from:', novelPageUrl);

  const htmlResponse = await fetch(novelPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  console.log('HTML Response status:', htmlResponse.status);

  if (!htmlResponse.ok) {
    throw new Error(`HTML取得エラー! status: ${htmlResponse.status}, URL: ${novelPageUrl}`);
  }

  const html = await htmlResponse.text();
  console.log('HTML length:', html.length);
  
  // HTMLから本文を抽出
  const contentMatch = html.match(/<div id="novel_honbun"[^>]*>([\s\S]*?)<\/div>/);
  console.log('Content match found:', !!contentMatch);
  
  // APIから取得したメタ情報を使用、なければHTMLから抽出
  const title = metaData?.title || extractTitleFromHtml(html);
  const author = metaData?.writer || extractAuthorFromHtml(html);
  
  console.log('Final data:', { title, author, hasContent: !!contentMatch });
  
  return {
    title: title || 'タイトル不明',
    author: author || '著者不明',
    site: '小説家になろう',
    content: contentMatch 
      ? cleanHtmlContent(contentMatch[1])
      : 'コンテンツを取得できませんでした。',
    url: url,
    ncode: ncode,
    // APIから取得した追加情報
    story: metaData?.story || '',
    genre: metaData?.genre || '',
    general_firstup: metaData?.general_firstup || '',
    general_lastup: metaData?.general_lastup || ''
  };
}

/**
 * URLからncodeを抽出
 * 例: https://ncode.syosetu.com/n1234ab/ → n1234ab
 */
function extractNcode(url) {
  console.log('Extracting ncode from URL:', url);
  
  // ncode.syosetu.com/n1234ab/ の形式
  const match1 = url.match(/ncode\.syosetu\.com\/([a-z0-9]+)/i);
  if (match1) {
    const ncode = match1[1].toLowerCase();
    console.log('Matched pattern 1, ncode:', ncode);
    return ncode;
  }
  
  // novel18.syosetu.com/n1234ab/ の形式（R18）
  const match2 = url.match(/novel18\.syosetu\.com\/([a-z0-9]+)/i);
  if (match2) {
    const ncode = match2[1].toLowerCase();
    console.log('Matched pattern 2 (R18), ncode:', ncode);
    return ncode;
  }
  
  // その他の形式（例: https://syosetu.com/novel/n1234ab/）
  const match3 = url.match(/syosetu\.com\/[^\/]*\/([a-z0-9]+)/i);
  if (match3) {
    const ncode = match3[1].toLowerCase();
    console.log('Matched pattern 3, ncode:', ncode);
    return ncode;
  }
  
  // より柔軟なマッチング（nで始まる6文字のコード）
  const match4 = url.match(/\/(n[a-z0-9]{5,})\//i);
  if (match4) {
    const ncode = match4[1].toLowerCase();
    console.log('Matched pattern 4 (flexible), ncode:', ncode);
    return ncode;
  }
  
  console.warn('No ncode pattern matched');
  return null;
}

/**
 * HTMLからタイトルを抽出（フォールバック用）
 */
function extractTitleFromHtml(html) {
  const titleMatch = html.match(/<p class="novel_title">([^<]+)<\/p>/);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * HTMLから著者名を抽出（フォールバック用）
 */
function extractAuthorFromHtml(html) {
  const authorMatch = html.match(/<p class="novel_writername">([^<]+)<\/p>/);
  return authorMatch ? authorMatch[1].trim() : null;
}

/**
 * カクヨムの小説を取得
 */
async function fetchKakuyomuNovel(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  
  // カクヨムのHTML構造に合わせてパース
  const titleMatch = html.match(/<h1[^>]*class="widget-episodeTitle"[^>]*>([^<]+)<\/h1>/);
  const authorMatch = html.match(/<a[^>]*class="widget-authorName"[^>]*>([^<]+)<\/a>/);
  const contentMatch = html.match(/<div[^>]*class="widget-episodeBody"[^>]*>([\s\S]*?)<\/div>/);

  return {
    title: titleMatch ? titleMatch[1].trim() : 'タイトル不明',
    author: authorMatch ? authorMatch[1].trim() : '著者不明',
    site: 'カクヨム',
    content: contentMatch 
      ? cleanHtmlContent(contentMatch[1])
      : 'コンテンツを取得できませんでした。',
    url: url
  };
}

/**
 * 汎用小説取得（基本的なHTMLパース）
 */
async function fetchGenericNovel(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  
  // 基本的なタイトルとコンテンツの抽出
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) 
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<div[^>]*class="content"[^>]*>([\s\S]*?)<\/div>/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : 'タイトル不明',
    author: '著者不明',
    site: new URL(url).hostname,
    content: contentMatch 
      ? cleanHtmlContent(contentMatch[1])
      : 'コンテンツを取得できませんでした。',
    url: url
  };
}

/**
 * HTMLコンテンツをクリーンアップ
 */
function cleanHtmlContent(html) {
  if (!html) return '';
  
  // HTMLタグを除去（簡易版）
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // スクリプト除去
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // スタイル除去
    .replace(/<[^>]+>/g, '\n') // タグを改行に変換
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // 連続する改行を整理
    .trim();

  // 段落の先頭に全角スペースを追加（日本語小説風）
  text = text.split('\n').map(line => {
    const trimmed = line.trim();
    return trimmed ? `　${trimmed}` : '';
  }).join('\n');

  return text;
}

