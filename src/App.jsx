import React, { useState, useEffect, useRef } from 'react';
import {
  Book,
  Plus,
  Settings,
  Moon,
  Sun,
  Coffee,
  ArrowLeft,
  Search,
  X,
  Type,
  Minus,
  Maximize,
  Link,
  Download,
  Loader,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Menu,
  Bookmark,
  MousePointer2,
  List,
  Home
} from 'lucide-react';
import { fetchNovelContent, extractNcode, searchNarou } from './utils/novelFetcher';
import { triggerFetch, pollData, fetchIndex } from './utils/githubActions';

/**
 * Tsunovel - Prototype v5
 * Update: 
 * 1. "Take out & Open" Animation (2-step transition)
 * 2. Wooden Shelf Design
 * 3. Fixed Z-Index Stacking Issues
 * 4. Enhanced Reader Settings (Font & Size Controls)
 */

// モックデータ
const INITIAL_NOVELS = [];

const MOCK_SEARCH_DB = [
  { title: "転生したらスライムだった件", author: "伏瀬", site: "Shosetsuka ni Naro", desc: "スライムとして異世界転生した主人公が...", keyword: "slime fantasy" },
  { title: "無職転生", author: "理不尽な孫の手", site: "Shosetsuka ni Naro", desc: "34歳無職が異世界で本気だす...", keyword: "magic wand" },
  { title: "本好きの下剋上", author: "香月美夜", site: "Shosetsuka ni Naro", desc: "本がないなら作ればいい...", keyword: "old book" },
  { title: "Re:Zeroから始める異世界生活", author: "長月達平", site: "Shosetsuka ni Naro", desc: "死に戻りの運命...", keyword: "dark fantasy" },
  { title: "オーバーロード", author: "丸山くがね", site: "Shosetsuka ni Naro", desc: "ゲーム世界に閉じ込められた...", keyword: "overlord game" },
  { title: "ソードアート・オンライン", author: "川原礫", site: "Shosetsuka ni Naro", desc: "VRMMOの世界で...", keyword: "sao vr" },
];

export default function Tsunovel() {
  const [novels, setNovels] = useState(INITIAL_NOVELS);
  const [currentNovelId, setCurrentNovelId] = useState(null);
  const [viewMode, setViewMode] = useState('library');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // アニメーション制御用ステート
  const [openingBookId, setOpeningBookId] = useState(null);
  const [selectedNovelId, setSelectedNovelId] = useState(null); // 詳細モーダル用
  const [isUpdateOptionsOpen, setIsUpdateOptionsOpen] = useState(false); // 更新オプション用
  const [updateEpisodesInput, setUpdateEpisodesInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(new Set());
  const [addMode, setAddMode] = useState('search'); // 'search' or 'url'
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [isPrepending, setIsPrepending] = useState(false);
  const scrollRef = useRef({ height: 0, top: 0 });
  const [githubConfig, setGithubConfig] = useState(() => {
    const saved = localStorage.getItem('tsunovel_github_config');
    return saved ? JSON.parse(saved) : {
      owner: 'soramk',
      repo: 'tsunovel',
      pat: '',
    };
  });
  const [tempGithubConfig, setTempGithubConfig] = useState(githubConfig);

  // 小説ごとのしおり（最新読了話数）
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('tsunovel_bookmarks');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('tsunovel_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // 設定が変更されたら localStorage に保存
  useEffect(() => {
    localStorage.setItem('tsunovel_github_config', JSON.stringify(githubConfig));
  }, [githubConfig]);

  const [readerSettings, setReaderSettings] = useState(() => {
    const saved = localStorage.getItem('tsunovel_reader_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'sepia',
      fontSize: 18,
      fontFamily: 'serif',
      lineHeight: 1.8,
      textColor: '', // Empty means use theme default
      transitionMode: 'button', // 'button' or 'scroll'
    };
  });

  useEffect(() => {
    localStorage.setItem('tsunovel_reader_settings', JSON.stringify(readerSettings));
  }, [readerSettings]);

  const [currentChapter, setCurrentChapter] = useState(1);
  const [readerChapters, setReaderChapters] = useState([]); // [{ chapterNum, content, title }]
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const settingsRef = useRef(null);

  // 初期読み込み: storage/index.json から小説一覧を取得
  useEffect(() => {
    const loadIndex = async () => {
      if (!githubConfig.owner || !githubConfig.repo) return;

      setIsLoadingIndex(true);
      setLoadError(null);
      console.log('Refreshing library index...');

      try {
        const index = await fetchIndex(githubConfig);
        if (index && Array.isArray(index) && index.length > 0) {
          const loadedNovels = index.map(item => ({
            id: item.ncode,
            title: item.title,
            author: item.writer,
            site: '小説家になろう',
            status: 'unread',
            progress: 0,
            ncode: item.ncode,
            content: null
          }));
          setNovels(loadedNovels);
        } else if (index && Array.isArray(index)) {
          setNovels([]); // 空配列の場合は正常終了として扱う
        } else {
          // エラーや無効なデータの場合（fetchIndex内でエラーログ出力済み）
          setLoadError('データの取得に失敗したか、ファイルがありません');
        }
      } catch (err) {
        setLoadError('接続エラーが発生しました');
      } finally {
        setIsLoadingIndex(false);
      }
    };
    loadIndex();
  }, [githubConfig.owner, githubConfig.repo, githubConfig.pat]);

  // 設定パネルの外側クリックで閉じる (リーダー内のクイック設定用)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen && viewMode === 'reader') {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen, viewMode]);

  /**
   * 小説の個別情報 (info.json) を取得する
   */
  const loadNovelInfo = async (novelId) => {
    const novel = novels.find(n => n.id === novelId);
    if (!novel || novel.info) return; // すでに取得済みなら何もしない

    try {
      const ncodeLower = novel.ncode.toLowerCase();
      const infoUrl = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/storage/${ncodeLower}/info.json`;

      const fetchOptions = githubConfig.pat ? {
        headers: {
          'Authorization': `Bearer ${githubConfig.pat}`,
          'Accept': 'application/vnd.github.v3.raw',
        }
      } : {};

      const infoRes = await fetch(infoUrl, fetchOptions);
      if (infoRes.ok) {
        const infoText = await infoRes.text();
        const infoData = JSON.parse(infoText);

        setNovels(prev => prev.map(n =>
          n.id === novelId ? { ...n, info: infoData } : n
        ));
      }
    } catch (e) {
      console.error('Failed to load novel info:', e);
    }
  };

  // 本を選択した際の情報ロード
  useEffect(() => {
    if (selectedNovelId) {
      loadNovelInfo(selectedNovelId);
    }
  }, [selectedNovelId]);

  // 本を開くアニメーション処理
  const handleBookClick = async (novelId) => {
    if (openingBookId) return;

    const novel = novels.find(n => n.id === novelId);
    const startChapter = bookmarks[novelId] || 1;

    // 常に指定された話数（またはしおり）からロードして readerChapters を初期化する
    setOpeningBookId(novelId);
    await loadChapter(novelId, startChapter);

    // 1.5秒後に画面遷移
    setTimeout(() => {
      setCurrentNovelId(novelId);
      setViewMode('reader');
      setOpeningBookId(null);

      setNovels(prev => prev.map(n =>
        n.id === novelId && n.status === 'unread' ? { ...n, status: 'reading' } : n
      ));
    }, 1500);
  };

  /**
   * 特定の話数を読み込む
   */
  const loadChapter = async (novelId, chapterNum, mode = 'replace', isPrefetch = false) => {
    const novel = novels.find(n => n.id === novelId);
    if (!novel) return;

    // 重複読み込み防止 (Setを使用)
    if (loadingChapters.has(chapterNum)) return;

    // スクロールモードで既に読み込み済みの場合はスキップ（appendの場合のみ）
    if (mode === 'append' && readerChapters.some(c => c.chapterNum === chapterNum)) return;

    if (!isPrefetch) {
      setLoadingChapters(prev => new Set(prev).add(chapterNum));
    }

    if (mode === 'replace' && !isPrefetch) {
      setIsLoadingChapter(true);
      setReaderChapters([]);
    }

    try {
      // GitHub API 経由での取得
      const ncodeLower = novel.ncode.toLowerCase();
      const chapterUrl = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/storage/${ncodeLower}/chapters/${chapterNum}.txt`;
      const infoUrl = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/storage/${ncodeLower}/info.json`;

      let novelContent = '';
      let infoData = novel.info || null;

      const fetchOptions = githubConfig.pat ? {
        headers: {
          'Authorization': `Bearer ${githubConfig.pat}`,
          'Accept': 'application/vnd.github.v3.raw',
        }
      } : {};

      const contentRes = await fetch(chapterUrl, fetchOptions);
      if (contentRes.ok) {
        novelContent = await contentRes.text();
      } else if (chapterNum === 1) {
        const legacyUrl = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/storage/${ncodeLower}/content.txt`;
        const legacyRes = await fetch(legacyUrl, fetchOptions);
        if (legacyRes.ok) {
          novelContent = await legacyRes.text();
        }
      }

      if (!novelContent && !isPrefetch) {
        // プリロードでない場合のみエラー表示
        // もし取得できなかったら何もしない（またはエラー文を入れる）
      }

      if (!infoData) {
        const infoRes = await fetch(infoUrl, fetchOptions);
        if (infoRes.ok) {
          const infoText = await infoRes.text();
          try {
            infoData = JSON.parse(infoText);
          } catch (e) {
            console.error('Failed to parse info JSON:', e);
          }
        }
      }

      // 章タイトルの抽出（コンテンツの最初の行が「■ 」で始まっている場合）
      let title = `Chapter ${chapterNum}`;
      if (novelContent && novelContent.startsWith('■ ')) {
        const firstLine = novelContent.split('\n')[0];
        title = firstLine.replace('■ ', '');
      }

      const newChapter = {
        chapterNum,
        content: novelContent || (chapterNum === 1 ? (infoData?.story ? `【あらすじ】\n\n${infoData.story}` : '本文を取得できませんでした。') : '指定された話数はまだ取得されていません。'),
        title: title
      };

      if (isPrefetch) {
        // プリロードの場合はステートに入れず、成功したことだけログに出すか、
        // あるいは後で使いやすいようにしておく（現在は簡易的にログのみ、
        // または `readerChapters` に入れるロジックが必要）
        // スクロールモードなら既に追加されているはずなので、ここでは「何もしない」
        // もしくはキャッシュ的な仕組みに入れる
        console.log(`Prefetched chapter ${chapterNum}`);
        return;
      }

      if (mode === 'append') {
        setReaderChapters(prev => {
          if (prev.some(c => c.chapterNum === chapterNum)) return prev;
          return [...prev, newChapter];
        });
      } else if (mode === 'prepend') {
        const currentHeight = document.documentElement.scrollHeight;
        const currentTop = window.scrollY;
        scrollRef.current = { height: currentHeight, top: currentTop };
        setIsPrepending(true);
        setReaderChapters(prev => {
          if (prev.some(c => c.chapterNum === chapterNum)) return prev;
          return [newChapter, ...prev];
        });
      } else {
        setReaderChapters([newChapter]);
        setCurrentChapter(chapterNum);
        window.scrollTo(0, 0);
      }

      setNovels(prev => prev.map(n =>
        n.id === novelId ? {
          ...n,
          info: infoData
        } : n
      ));

      // しおりを更新
      setBookmarks(prev => ({ ...prev, [novelId]: chapterNum }));

    } catch (error) {
      console.error('Error loading chapter:', error);
    } finally {
      setLoadingChapters(prev => {
        const next = new Set(prev);
        next.delete(chapterNum);
        return next;
      });
      if (mode === 'replace') setIsLoadingChapter(false);
    }
  };

  /**
   * 小説の情報を最新に同期・更新する
   */
  const handleSyncNovel = async (novelId, type = 'full', episodes = '') => {
    const novel = novels.find(n => n.id === novelId);
    if (!novel) return;

    setIsDownloading(true);
    setDownloadProgress(`${novel.title} を更新中...`);
    setIsUpdateOptionsOpen(false);

    try {
      // GitHub Actionsをトリガー
      await triggerFetch(novel.ncode, githubConfig, type, episodes);

      setDownloadProgress('同期中... 完了まで最大1分かかります。');

      // 結果をポーリング（info.jsonを再取得）
      const data = await pollData(novel.ncode, githubConfig);

      console.log('Novel sync completed:', data);

      // novels ステートを更新
      setNovels(prev => prev.map(n =>
        n.id === novelId ? {
          ...n,
          title: data.title || n.title,
          author: data.writer || data.author || n.author,
          info: data
        } : n
      ));

      setDownloadProgress('更新が完了しました');
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress('');
      }, 2000);

    } catch (error) {
      console.error('Error syncing novel:', error);
      setDownloadProgress(`同期エラー: ${error.message}`);
      setTimeout(() => setIsDownloading(false), 5000);
    }
  };

  const nextChapter = () => {
    const novel = novels.find(n => n.id === currentNovelId);
    if (!novel || !novel.info) return;

    // スクロールモードでも「次の話」ボタンが押された場合は、
    // 現在のチャプターをインクリメントして、単体ロード（または末尾追加）を行う
    const nextNum = currentChapter + 1;

    if (nextNum <= (novel.info?.general_all_no || 0)) {
      loadChapter(currentNovelId, nextNum, 'replace');
    }
  };

  const prevChapter = () => {
    if (currentChapter > 1) {
      loadChapter(currentNovelId, currentChapter - 1, 'replace');
    }
  };


  const closeReader = () => {
    setViewMode('library');
    setCurrentNovelId(null);
    setIsSettingsOpen(false);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchNarou(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addFromSearch = async (item) => {
    setIsDownloading(true);
    setDownloadProgress(`${item.title} の取得準備中...`);

    try {
      const ncode = item.ncode;
      console.log('Adding from search:', item.title, ncode);

      setDownloadProgress('GitHub Actionsを起動中...');
      await triggerFetch(ncode, githubConfig);

      setDownloadProgress('バックエンドで処理中... 完了まで最大1-2分かかります。');
      const data = await pollData(ncode, githubConfig);

      const newNovel = {
        id: Date.now(),
        title: data.title || item.title,
        author: data.writer || data.author || item.author,
        site: '小説家になろう',
        status: 'unread',
        progress: 0,
        content: data.story ? `【あらすじ】\n\n${data.story}` : '本文を取得中...',
        ncode: ncode
      };

      setNovels([newNovel, ...novels]);
      setIsAddModalOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setDownloadProgress('');
      setIsDownloading(false);
    } catch (error) {
      console.error('Error adding from search:', error);
      setDownloadProgress(`エラー: ${error.message}`);
      setTimeout(() => setIsDownloading(false), 5000);
    }
  };

  const handleUrlDownload = async () => {
    if (!urlInput.trim()) return;

    setIsDownloading(true);
    setDownloadProgress('小説情報を取得中...');

    try {
      console.log('Fetching novel from URL:', urlInput);

      const ncode = extractNcode(urlInput);
      if (!ncode) {
        throw new Error('小説家になろうのURLからNコードを抽出できませんでした');
      }

      setDownloadProgress('GitHub Actionsを起動中...');

      // GitHub Actionsをトリガー
      await triggerFetch(ncode, githubConfig);

      setDownloadProgress('バックエンドで処理中... 完了まで最大1-2分かかります。');

      // 結果をポーリング
      const data = await pollData(ncode, githubConfig);

      console.log('Novel data fetched via GitHub Actions:', data);
      setDownloadProgress('ライブラリに追加中...');

      const newNovel = {
        id: Date.now(),
        title: data.title || 'タイトル不明',
        author: data.writer || data.author || '著者不明',
        site: '小説家になろう',
        status: 'unread',
        progress: 0,
        content: data.story
          ? `【あらすじ】\n\n${data.story}\n\n\n※本文は小説家になろうのサイトで直接ご覧ください。\nURL: ${urlInput}`
          : '※本文は小説家になろうのサイトで直接ご覧ください。',
        url: urlInput,
        ncode: ncode
      };

      setNovels([newNovel, ...novels]);
      setIsAddModalOpen(false);
      setUrlInput('');
      setDownloadProgress('');
      setIsDownloading(false);
    } catch (error) {
      console.error('Error downloading novel:', error);
      const errorMessage = error.message || '不明なエラーが発生しました';
      setDownloadProgress(`エラー: ${errorMessage}`);

      // エラーメッセージは既にUIに表示されているため、5秒後にリセット
      setTimeout(() => {
        setIsDownloading(false);
        // エラーメッセージは残しておく（ユーザーが確認できるように）
      }, 5000);
    }
  };

  const getReaderStyles = () => {
    const base = "max-w-3xl mx-auto p-8 min-h-screen transition-colors duration-300";
    let themeClass = "";
    let fontClass = "";

    switch (readerSettings.theme) {
      case 'dark': themeClass = "bg-gray-900 text-gray-300"; break;
      case 'sepia': themeClass = "bg-[#f4ecd8] text-[#5b4636]"; break;
      case 'midnight': themeClass = "bg-[#0f172a] text-[#94a3b8]"; break;
      case 'ivory': themeClass = "bg-[#fffff0] text-[#2d241e]"; break;
      case 'softgreen': themeClass = "bg-[#f0f9f0] text-[#2d4a2d]"; break;
      case 'ocean': themeClass = "bg-[#e0f2f1] text-[#004d40]"; break;
      case 'forest': themeClass = "bg-[#e8f5e9] text-[#1b5e20]"; break;
      case 'paper': themeClass = "bg-[#fafafa] text-[#424242] border-x border-gray-200 shadow-inner"; break;
      case 'coffee-deep': themeClass = "bg-[#3e2723] text-[#d7ccc8]"; break;
      default: themeClass = "bg-white text-gray-900"; break;
    }

    switch (readerSettings.fontFamily) {
      case 'serif': fontClass = "serif"; break;
      case 'noto-serif': fontClass = "'Noto Serif JP', serif"; break;
      case 'noto-sans': fontClass = "'Noto Sans JP', sans-serif"; break;
      case 'mplus': fontClass = "'M PLUS 1p', sans-serif"; break;
      case 'zen-kaku': fontClass = "'Zen Kaku Gothic New', sans-serif"; break;
      case 'kaisei': fontClass = "'Kaisei Tokumin', serif"; break;
      case 'shippori': fontClass = "'Shippori Mincho', serif"; break;
      case 'dotgothic': fontClass = "'DotGothic16', sans-serif"; break;
      case 'hina': fontClass = "'Hina Mincho', serif"; break;
      case 'courier': fontClass = "'Courier Prime', monospace"; break;
      default: fontClass = "sans-serif"; break;
    }

    return {
      className: `${base} ${themeClass}`,
      style: {
        fontSize: `${readerSettings.fontSize}px`,
        lineHeight: readerSettings.lineHeight,
        fontFamily: fontClass,
        color: readerSettings.textColor || undefined
      }
    };
  };

  const [isTocOpen, setIsTocOpen] = useState(false);
  const currentNovel = novels.find(n => n.id === currentNovelId);

  // スクロール位置の調整（前章 prepend 時）
  useEffect(() => {
    if (isPrepending && readerChapters.length > 0) {
      const newHeight = document.documentElement.scrollHeight;
      const heightDiff = newHeight - scrollRef.current.height;
      if (heightDiff > 0) {
        window.scrollTo(0, scrollRef.current.top + heightDiff);
      }
      setIsPrepending(false);
    }
  }, [readerChapters, isPrepending]);

  // スクロール検知：最下部到達で次章読み込み ＆ 現在表示中の章を特定
  useEffect(() => {
    if (viewMode !== 'reader') return;

    const handleScroll = () => {
      // 1. 最下部到達検知（スクロールモード時）
      if (readerSettings.transitionMode === 'scroll') {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 300) {
          // 連続読みのため、現在読み込み済みの最後の章の次を読み込む
          const lastLoadedChapter = readerChapters.length > 0
            ? readerChapters[readerChapters.length - 1].chapterNum
            : currentChapter;

          if (!isLoadingChapter && currentNovel && lastLoadedChapter < currentNovel.info?.general_all_no) {
            // 読み込み中または既にリストにある場合はスキップ
            const isAlreadyLoaded = readerChapters.some(c => c.chapterNum === lastLoadedChapter + 1);
            const isCurrentlyLoading = loadingChapters.has(lastLoadedChapter + 1);

            if (!isAlreadyLoaded && !isCurrentlyLoading) {
              loadChapter(currentNovelId, lastLoadedChapter + 1, 'append');
            }
          }
        }

        // 1.5. 最上部到達検知（スクロールモード時：前章読み込み）
        if (scrollTop < 50) {
          const firstLoadedChapter = readerChapters.length > 0
            ? readerChapters[0].chapterNum
            : currentChapter;

          if (!isLoadingChapter && currentNovel && firstLoadedChapter > 1) {
            const isAlreadyLoaded = readerChapters.some(c => c.chapterNum === firstLoadedChapter - 1);
            const isCurrentlyLoading = loadingChapters.has(firstLoadedChapter - 1);

            if (!isAlreadyLoaded && !isCurrentlyLoading) {
              loadChapter(currentNovelId, firstLoadedChapter - 1, 'prepend');
            }
          }
        }
      }

      // 2. 現在表示中の章（画面中央付近にある章）の特定としおり更新
      const chapterSections = document.querySelectorAll('.reader-chapter-section');
      let currentVisibleChapter = currentChapter;

      chapterSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        // 画面の上部 1/3 付近にあるセクションを「現在読んでいる」とみなす
        if (rect.top < window.innerHeight / 3 && rect.bottom > window.innerHeight / 3) {
          currentVisibleChapter = parseInt(section.dataset.chapter);
        }
      });

      if (currentVisibleChapter !== currentChapter) {
        setCurrentChapter(currentVisibleChapter);
        if (currentNovelId) {
          setBookmarks(prev => ({ ...prev, [currentNovelId]: currentVisibleChapter }));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode, readerSettings.transitionMode, isLoadingChapter, currentNovel, currentChapter, readerChapters]);

  // 次話プリロード機能 (読書中にバックグラウンドで取得)
  useEffect(() => {
    if (viewMode !== 'reader' || !currentNovelId || !currentChapter) return;

    const novel = novels.find(n => n.id === currentNovelId);
    if (!novel || !novel.info) return;

    const nextChap = currentChapter + 1;
    if (nextChap <= (novel.info.general_all_no || 0)) {
      // 既にロード済み（readerChaptersにある）かチェック
      const isLoaded = readerChapters.some(c => c.chapterNum === nextChap);
      if (!isLoaded && !loadingChapters.has(nextChap)) {
        console.log(`Prefetching chapter ${nextChap}...`);
        // スクロールモードなら append、ボタンモードなら prefetch のみ
        if (readerSettings.transitionMode === 'scroll') {
          loadChapter(currentNovelId, nextChap, 'append');
        } else {
          loadChapter(currentNovelId, nextChap, 'replace', true);
        }
      }
    }
  }, [currentChapter, viewMode, currentNovelId, readerSettings.transitionMode]);

  return (
    <div className="min-h-screen bg-[#2c241b] text-gray-100 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">

      {/* --- Library Mode --- */}
      {viewMode === 'library' && (
        <>
          <header className="bg-[#1e1915] text-[#d7ccc8] shadow-2xl sticky top-0 z-30 border-b border-[#3e2723]">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex flex-col items-center py-12">
                <img src="/pict/title.png" alt="" className="h-48 md:h-72 w-auto mb-4" />
              </div>
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => setViewMode('settings')}
                  className="p-2 text-[#d7ccc8] hover:bg-[#3e2723] rounded-lg transition-colors"
                  title="設定"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-[#8d6e63] hover:bg-[#795548] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 border border-[#a1887f]"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">小説を追加</span>
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 py-8 relative min-h-[calc(100vh-64px)]">
            {/* Library Content */}

            {/* Bookshelf Grid */}
            <div className="min-h-[400px]">
              {isLoadingIndex ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#d7ccc8] gap-4">
                  <Loader className="animate-spin" size={48} />
                  <p className="font-serif italic">Library loading...</p>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-8 max-w-sm">
                    <X size={48} className="mx-auto mb-4 text-red-400" />
                    <h3 className="text-xl font-bold text-white mb-2 font-serif">Oops!</h3>
                    <p className="text-red-200 text-sm mb-6">{loadError}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full text-sm font-bold transition-colors shadow-lg"
                    >
                      Retry
                    </button>
                    <p className="mt-4 text-[10px] text-red-300 opacity-60">※PATの設定やリポジトリ名を確認してください</p>
                  </div>
                </div>
              ) : novels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#d7ccc8] opacity-50 text-center px-4">
                  <Book size={48} className="mb-4" />
                  <p className="font-serif italic mb-2">Shelf is empty.</p>
                  <p className="text-xs">「小説を追加」から作品をダウンロードしてください</p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 px-4 pb-60 max-w-6xl mx-auto items-end pt-32">
                  {novels.map((novel, index) => {
                    const isOpening = openingBookId === novel.id;

                    // 背表紙のデザイン（よりリアルなテクスチャ）
                    const spineStyles = [
                      { bg: 'bg-[#3e2e28]', border: 'border-[#513c34]', pattern: 'inset-y-0 left-0 w-[2px] bg-black/20' },
                      { bg: 'bg-[#2d241e]', border: 'border-[#3f322a]', pattern: 'inset-y-0 left-1 w-[1px] bg-white/5' },
                      { bg: 'bg-[#4a3728]', border: 'border-[#5e4633]', pattern: 'inset-y-0 right-1 w-[1px] bg-black/30' },
                      { bg: 'bg-[#5d4037]', border: 'border-[#6f4f44]', pattern: 'inset-y-0 left-2 w-[1px] bg-black/10' },
                      { bg: 'bg-[#3e2723]', border: 'border-[#4e342e]', pattern: 'inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_100%)]' },
                      { bg: 'bg-[#263238]', border: 'border-[#37474f]', pattern: 'inset-y-0 left-1 w-[1px] bg-white/10' },
                      { bg: 'bg-[#1a237e]', border: 'border-[#283593]', pattern: 'inset-y-0 left-1 w-[2px] bg-black/20' },
                      { bg: 'bg-[#1b5e20]', border: 'border-[#2e7d32]', pattern: 'inset-y-0 right-2 w-[1px] bg-black/20' }
                    ];
                    const seedId = Math.abs(novel.id.toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0));
                    const style = spineStyles[seedId % spineStyles.length];

                    return (
                      <div
                        key={novel.id}
                        className={`relative group ${isOpening ? 'z-50' : 'hover:z-40 z-10'}`}
                      >
                        {/* --- SPINE ONLY VIEW --- */}
                        <div
                          onClick={() => setSelectedNovelId(novel.id)}
                          className={`
                            relative w-10 sm:w-14 h-48 sm:h-64 cursor-pointer transition-all duration-300 transform
                            ${style.bg} ${style.border} rounded-sm shadow-[2px_4px_12px_rgba(0,0,0,0.5),inset_-1px_0_3px_rgba(255,255,255,0.1)] 
                            border-l border-t border-b flex items-center justify-center
                            hover:-translate-y-4 hover:brightness-110 active:scale-95
                            ${isOpening ? 'opacity-0 scale-150' : 'opacity-100'}
                          `}
                        >
                          {/* テクスチャオーバーレイ */}
                          <div className={`absolute ${style.pattern} opacity-50`}></div>
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leather.png')] opacity-10 mix-blend-overlay"></div>
                          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-black/30 to-transparent"></div>

                          <div className="h-full py-6 flex flex-col items-center justify-between text-[#e0d0c0]/90 z-10">
                            <div className="w-[1px] h-4 bg-[#e0d0c0]/20"></div>
                            <span className="text-[11px] sm:text-[13px] font-serif font-bold vertical-rl tracking-[0.2em] truncate max-h-[85%] px-1 text-center"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                              {novel.title}
                            </span>
                            <div className="w-[1px] h-4 bg-[#e0d0c0]/20"></div>
                          </div>

                          {/* ステータスサイン (より上品に) */}
                          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${novel.status === 'reading' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-green-500 opacity-40 shadow-[0_0_4px_rgba(34,197,94,0.4)]'}`}></div>
                        </div>

                        {/* 本を開く際のアニメーション用オーバーレイ */}
                        {isOpening && (
                          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
                            <div className="relative w-64 aspect-[2/3] animate-in zoom-in-50 duration-700 ease-out preserve-3d">
                              <div className="absolute inset-0 bg-cover bg-center rounded shadow-2xl transition-transform duration-1000 rotate-y-[-140deg] origin-left border border-white/10"
                                style={{ backgroundImage: `url(https://picsum.photos/seed/${novel.id + 200}/300/450)` }}>
                              </div>
                              <div className="absolute inset-x-[1%] inset-y-[2%] bg-white rounded-l shadow-inner -translate-z-1"
                                style={{ backgroundImage: 'repeating-linear-gradient(90deg, #e0e0e0, #e0e0e0 1px, #fff 1px, #fff 3px)' }}>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 床の影 */}
                        <div className="absolute -bottom-4 left-0 right-0 h-2 bg-black/40 blur-md rounded-full scale-75 group-hover:scale-100 transition-all duration-300"></div>

                        {/* --- SHELF BOARD (棚板) --- */}
                        <div className="absolute -bottom-6 -left-4 -right-4 h-4 bg-[#3e2723] rounded-sm shadow-xl z-[-1]">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4e342e]"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* --- Detail Modal --- */}
            {selectedNovelId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300 backdrop-blur-md bg-black/40" onClick={() => setSelectedNovelId(null)}>
                <div className="bg-[#fdfbf7] text-[#2d241e] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom-8 duration-500" onClick={e => e.stopPropagation()}>
                  {/* 左側: カバー画像 */}
                  <div className="w-full md:w-1/3 aspect-[2/3] md:aspect-auto bg-cover bg-center relative group"
                    style={{ backgroundImage: `url(https://picsum.photos/seed/${selectedNovelId + 200}/300/450)` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <p className="text-white text-[10px] sm:text-xs font-bold tracking-widest uppercase opacity-70">
                        {novels.find(n => n.id === selectedNovelId)?.site}
                      </p>
                    </div>
                  </div>

                  {/* 右側: 詳細情報 */}
                  <div className="flex-1 p-6 sm:p-8 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-serif font-bold mb-1 leading-tight">
                          {novels.find(n => n.id === selectedNovelId)?.title}
                        </h3>
                        <p className="text-sm opacity-60 italic">{novels.find(n => n.id === selectedNovelId)?.author}</p>
                      </div>
                      <button onClick={() => setSelectedNovelId(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-8 pr-2 custom-scrollbar">
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="bg-amber-100/50 px-3 py-1 rounded text-[10px] font-bold text-amber-800 border border-amber-200">
                            {novels.find(n => n.id === selectedNovelId)?.info?.general_all_no || "?"} 話
                          </div>
                          <div className="bg-gray-100 px-3 py-1 rounded text-[10px] font-bold text-gray-600 border border-gray-200">
                            {novels.find(n => n.id === selectedNovelId)?.info?.genre || "ジャンル未設定"}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-80">
                          {novels.find(n => n.id === selectedNovelId)?.info?.story || "あらすじを取得できませんでした。"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          const id = selectedNovelId;
                          setSelectedNovelId(null);
                          handleBookClick(id);
                        }}
                        className="w-full bg-[#3e2723] hover:bg-[#2d1a16] text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Book size={20} />
                        物語に入る
                      </button>

                      <div className="flex gap-2 relative">
                        <button
                          onClick={() => setIsUpdateOptionsOpen(!isUpdateOptionsOpen)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-sm ${isUpdateOptionsOpen ? 'border-[#8d6e63] bg-amber-50 text-[#8d6e63]' : 'border-gray-200 text-gray-500 hover:border-gray-300 opacity-60'}`}
                        >
                          <Loader size={16} className={isDownloading ? 'animate-spin' : ''} />
                          更新オプション
                        </button>

                        {isUpdateOptionsOpen && (
                          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-10 animate-in slide-in-from-bottom-2 duration-200">
                            <div className="flex flex-col gap-1">
                              <button onClick={() => handleSyncNovel(selectedNovelId, 'full')} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors">全更新 (すべての話数を再取得)</button>
                              <button onClick={() => handleSyncNovel(selectedNovelId, 'new')} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors">未取得話（新規）のみ更新</button>
                              <div className="p-2 border-t border-gray-100 mt-1">
                                <p className="text-[10px] text-gray-400 mb-2 px-2">指定エピソードのみ更新 (例: 1,5,10)</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="1, 2, 3..."
                                    className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 transition-all font-mono"
                                    value={updateEpisodesInput}
                                    onChange={(e) => setUpdateEpisodesInput(e.target.value)}
                                  />
                                  <button
                                    onClick={() => handleSyncNovel(selectedNovelId, 'specific', updateEpisodesInput)}
                                    className="bg-amber-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold hover:bg-amber-700 transition-colors"
                                  >更新</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* --- Reader Mode --- */}
      {viewMode === 'reader' && (
        <div className="bg-[#f3f0e9] min-h-screen animate-in fade-in duration-1000">
          {/* Top Reader Bar */}
          <div className="fixed top-0 left-0 right-0 h-14 bg-[#f3f0e9]/95 backdrop-blur border-b border-[#e5e0d0] flex items-center justify-between px-4 z-20 transition-all">
            <button
              onClick={() => setIsTocOpen(!isTocOpen)}
              className={`p-2 rounded-lg transition-colors ${isTocOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-[#e5e0d0]'}`}
              title="目次"
            >
              <List size={20} />
            </button>
            <div className="text-sm font-bold text-gray-800 font-serif tracking-wide truncate max-w-[200px] sm:max-w-md">
              {novels.find(n => n.id === currentNovelId)?.title}
            </div>
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-lg transition-colors ${isSettingsOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-[#e5e0d0]'}`}
                title="表示設定"
              >
                <Settings size={20} />
              </button>
              {isSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 p-5 z-30 transition-all animate-in zoom-in-95 duration-200">
                  <div className="space-y-6">
                    {/* テーマ設定 */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">テーマ</label>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500">{readerSettings.theme}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'light', icon: Sun, label: 'ライト', class: 'bg-white text-gray-800' },
                          { id: 'sepia', icon: Coffee, label: 'セピア', class: 'bg-[#f4ecd8] text-[#5b4636]' },
                          { id: 'dark', icon: Moon, label: 'ダーク', class: 'bg-gray-800 text-gray-100' },
                          { id: 'midnight', icon: Bookmark, label: 'ミッド', class: 'bg-[#0f172a] text-[#94a3b8]' },
                          { id: 'ivory', icon: Type, label: 'アイボ', class: 'bg-[#fffff0] text-[#2d241e]' },
                          { id: 'softgreen', icon: Book, label: 'グリーン', class: 'bg-[#f0f9f0] text-[#2d4a2d]' },
                          { id: 'ocean', icon: MousePointer2, label: 'オーシャン', class: 'bg-[#e0f2f1] text-[#004d40]' },
                          { id: 'forest', icon: Plus, label: '森', class: 'bg-[#e8f5e9] text-[#1b5e20]' },
                          { id: 'paper', icon: Book, label: '紙', class: 'bg-[#fafafa] text-[#424242]' },
                          { id: 'coffee-deep', icon: Coffee, label: '珈琲', class: 'bg-[#3e2723] text-[#d7ccc8]' },
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setReaderSettings({ ...readerSettings, theme: t.id })}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${readerSettings.theme === t.id ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent hover:bg-gray-50'}`}
                          >
                            <div className={`w-8 h-8 rounded-full mb-1 flex items-center justify-center shadow-sm ${t.class} border border-gray-200`}>
                              <t.icon size={14} />
                            </div>
                            <span className="text-[10px] font-bold">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* フォント設定 */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">フォント</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                        {[
                          { id: 'serif', label: '標準明朝', font: 'font-serif' },
                          { id: 'sans', label: '標準ゴシック', font: 'font-sans' },
                          { id: 'noto-serif', label: 'Noto Serif', font: 'font-serif' },
                          { id: 'noto-sans', label: 'Noto Sans', font: 'font-sans' },
                          { id: 'mplus', label: 'M PLUS', font: 'font-sans' },
                          { id: 'zen-kaku', label: 'Zen Kaku', font: 'font-sans' },
                          { id: 'kaisei', label: 'Kaisei', font: 'font-serif' },
                          { id: 'shippori', label: 'Shippori', font: 'font-serif' },
                          { id: 'hina', label: 'Hina', font: 'font-serif' },
                          { id: 'dotgothic', label: 'DotGothic', font: 'font-sans' },
                          { id: 'courier', label: 'Courier', font: 'font-mono' },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setReaderSettings({ ...readerSettings, fontFamily: f.id })}
                            className={`py-2 px-2 rounded-md text-xs transition-all ${readerSettings.fontFamily === f.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
                          >
                            <span className={f.font}>{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 文字色設定 */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">文字色</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setReaderSettings({ ...readerSettings, textColor: '' })}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${readerSettings.textColor === '' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white text-gray-400'}`}
                          title="テーマのデフォルト色を使用"
                        >
                          自動
                        </button>
                        {[
                          '#000000', '#333333', '#666666', '#999999',
                          '#d7ccc8', '#5b4636', '#1b5e20', '#004d40',
                          '#0d47a1', '#b71c1c'
                        ].map(color => (
                          <button
                            key={color}
                            onClick={() => setReaderSettings({ ...readerSettings, textColor: color })}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${readerSettings.textColor === color ? 'border-indigo-500 scale-110' : 'border-transparent opacity-80 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <div className="relative group">
                          <input
                            type="color"
                            value={readerSettings.textColor || '#000000'}
                            onChange={(e) => setReaderSettings({ ...readerSettings, textColor: e.target.value })}
                            className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden p-0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 文字サイズと行間 */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">文字サイズ</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontSize: Math.max(12, readerSettings.fontSize - 1) })}
                            className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95"
                            title="小さく"
                          >
                            <Minus size={18} />
                          </button>
                          <input
                            type="range"
                            min="12"
                            max="40"
                            value={readerSettings.fontSize}
                            onChange={(e) => setReaderSettings({ ...readerSettings, fontSize: parseInt(e.target.value) })}
                            className="flex-1 accent-indigo-600 h-2"
                          />
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontSize: Math.min(40, readerSettings.fontSize + 1) })}
                            className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95"
                            title="大きく"
                          >
                            <Plus size={18} />
                          </button>
                          <span className="text-sm font-mono w-6 text-right font-bold text-indigo-600">{readerSettings.fontSize}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">行間</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, lineHeight: Math.max(0.5, Math.round((readerSettings.lineHeight - 0.1) * 10) / 10) })}
                            className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95"
                            title="狭く"
                          >
                            <Minus size={18} />
                          </button>
                          <input
                            type="range"
                            min="0.5"
                            max="3.0"
                            step="0.1"
                            value={readerSettings.lineHeight}
                            onChange={(e) => setReaderSettings({ ...readerSettings, lineHeight: parseFloat(e.target.value) })}
                            className="flex-1 accent-indigo-600 h-2"
                          />
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, lineHeight: Math.min(3.0, Math.round((readerSettings.lineHeight + 0.1) * 10) / 10) })}
                            className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md active:scale-95"
                            title="広く"
                          >
                            <Plus size={18} />
                          </button>
                          <span className="text-sm font-mono w-6 text-right font-bold text-indigo-600">{readerSettings.lineHeight}</span>
                        </div>
                      </div>
                    </div>

                    {/* 遷移設定 */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <MousePointer2 size={12} />
                        次の話への遷移
                      </label>
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setReaderSettings({ ...readerSettings, transitionMode: 'button' })}
                          className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${readerSettings.transitionMode === 'button' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'}`}
                        >
                          ボタン
                        </button>
                        <button
                          onClick={() => setReaderSettings({ ...readerSettings, transitionMode: 'scroll' })}
                          className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${readerSettings.transitionMode === 'scroll' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'}`}
                        >
                          スクロール
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TOC Sidenav */}
          {isTocOpen && (
            <div
              className="fixed inset-0 z-40 flex"
              onClick={() => setIsTocOpen(false)}
            >
              <div
                className="w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <h3 className="font-serif font-bold text-xl text-gray-800">目次</h3>
                  <button onClick={() => setIsTocOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={24} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {currentNovel?.info?.general_all_no ? (
                    Array.from({ length: currentNovel.info.general_all_no }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => {
                          loadChapter(currentNovelId, num);
                          setIsTocOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between group ${currentChapter === num ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-6 text-[10px] flex items-center justify-center rounded ${currentChapter === num ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                            {num}
                          </span>
                          第 {num} 話
                        </span>
                        {bookmarks[currentNovelId] === num && (
                          <Bookmark size={12} className="text-indigo-400Fill" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 italic text-sm">
                      話数情報がありません
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-black/40 backdrop-blur-sm"></div>
            </div>
          )}

          {/* Bottom Reader Navigation */}
          <footer className={`fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-current/10 flex items-center justify-center transition-colors duration-300 backdrop-blur-md bg-opacity-90 ${getReaderStyles().className.replace(/max-w-3xl|mx-auto|p-8|min-h-screen/g, '')}`}>
            <div className="max-w-2xl w-full flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('library')}
                  className="w-10 h-10 rounded-full border border-current/20 flex items-center justify-center hover:bg-current hover:text-white transition-all"
                  title="ライブラリに戻る"
                >
                  <Home size={20} />
                </button>
                <button
                  onClick={prevChapter}
                  disabled={currentChapter <= 1}
                  className="w-10 h-10 rounded-full border border-current flex items-center justify-center disabled:opacity-20 hover:bg-current hover:text-white transition-all shadow-sm"
                  title="前の話"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase truncate max-w-[120px]">
                  {currentNovel?.title}
                </span>
                <span className="text-sm font-serif font-bold italic">
                  {currentChapter} / {currentNovel?.info?.general_all_no || '?'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={nextChapter}
                  disabled={!currentNovel || currentChapter >= (currentNovel.info?.general_all_no || 0)}
                  className="w-10 h-10 rounded-full border border-current flex items-center justify-center disabled:opacity-20 hover:bg-current hover:text-white transition-all shadow-sm"
                  title="次の話"
                >
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSettingsOpen(!isSettingsOpen);
                  }}
                  className="w-10 h-10 rounded-full border border-current/20 flex items-center justify-center hover:bg-current hover:text-white transition-all shadow-sm"
                  title="設定"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
          </footer>

          {/* Reader Content */}
          <div className={`${getReaderStyles().className} pt-24`} style={getReaderStyles().style}>
            <div className="max-w-2xl mx-auto pb-32">
              <div className="mb-12 text-center border-b border-current/10 pb-8">
                <span className="text-xs font-bold tracking-[0.2em] opacity-50 uppercase block mb-2">
                  {novels.find(n => n.id === currentNovelId)?.info?.noveltype === 2 ? 'Short Story' : `Chapter ${currentChapter}`}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                  {novels.find(n => n.id === currentNovelId)?.title}
                </h1>
                <p className="text-sm opacity-60">
                  著者: {novels.find(n => n.id === currentNovelId)?.author}
                </p>
              </div>

              {isLoadingChapter && readerChapters.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
                  <Loader className="animate-spin" />
                  <p>読み込み中...</p>
                </div>
              ) : (
                <div className="space-y-16">
                  {readerChapters.map((chapter, idx) => (
                    <article
                      key={`${chapter.chapterNum}-${idx}`}
                      className="reader-chapter-section"
                      data-chapter={chapter.chapterNum}
                    >
                      {/* 章の境界線（2つ目以降の章のみ表示） */}
                      {idx > 0 && (
                        <div className="flex items-center gap-4 mb-16 opacity-30">
                          <div className="h-[1px] flex-1 bg-current"></div>
                          <span className="text-[10px] font-bold tracking-widest uppercase">Chapter {chapter.chapterNum}</span>
                          <div className="h-[1px] flex-1 bg-current"></div>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap text-justify">
                        {chapter.content}
                      </div>
                    </article>
                  ))}

                  {isLoadingChapter && (
                    <div className="py-10 flex items-center justify-center gap-3 opacity-30 text-sm italic">
                      <Loader className="animate-spin" size={16} />
                      <span>次の話を読み込み中...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              {!isLoadingChapter && novels.find(n => n.id === currentNovelId)?.info?.noveltype !== 2 && (
                <div className="mt-20 pt-10 border-t border-current/10 flex items-center justify-between">
                  <button
                    onClick={prevChapter}
                    disabled={currentChapter <= 1}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-current/5 disabled:opacity-20 transition-all font-bold"
                  >
                    <ArrowLeft size={18} />
                    前の話
                  </button>
                  <span className="text-sm opacity-50 font-bold">
                    {currentChapter} / {novels.find(n => n.id === currentNovelId)?.info?.general_all_no || '?'}
                  </span>
                  <button
                    onClick={nextChapter}
                    disabled={currentChapter >= (novels.find(n => n.id === currentNovelId)?.info?.general_all_no || 0)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-current/5 disabled:opacity-20 transition-all font-bold"
                  >
                    次の話
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}

              <div className="mt-20 flex justify-center opacity-50">
                <div className="w-2 h-2 rounded-full bg-current mx-1"></div>
                <div className="w-2 h-2 rounded-full bg-current mx-1"></div>
                <div className="w-2 h-2 rounded-full bg-current mx-1"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Settings Mode --- */}
      {viewMode === 'settings' && (
        <div className="min-h-screen bg-[#1e1915] text-[#d7ccc8] flex flex-col animate-in fade-in duration-300">
          <header className="bg-[#1e1915] border-b border-[#3e2723] p-4 flex items-center justify-between sticky top-0 z-10">
            <button onClick={() => setViewMode('library')} className="p-2 hover:bg-[#3e2723] rounded-lg transition-colors flex items-center gap-2">
              <ArrowLeft size={20} />
              <span className="font-serif">ライブラリに戻る</span>
            </button>
            <h2 className="font-serif font-bold text-xl">General Settings</h2>
            <div className="w-10"></div>
          </header>

          <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-8">
            <section className="bg-[#2d241b] rounded-2xl p-8 border border-[#3e2723] shadow-xl">
              <div className="flex items-center gap-3 mb-8 border-b border-[#3e2723] pb-4">
                <Settings className="text-[#8d6e63]" />
                <h3 className="text-xl font-bold font-serif">GitHub 設定</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#8d6e63] uppercase tracking-widest mb-2">Repository (Owner/Repo)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="owner"
                      className="flex-1 bg-[#1e1915] border border-[#3e2723] rounded-xl px-4 py-3 text-sm text-white focus:border-[#8d6e63] outline-none transition-all"
                      value={tempGithubConfig.owner}
                      onChange={(e) => setTempGithubConfig({ ...tempGithubConfig, owner: e.target.value })}
                    />
                    <span className="text-[#3e2723] font-bold">/</span>
                    <input
                      type="text"
                      placeholder="repo"
                      className="flex-1 bg-[#1e1915] border border-[#3e2723] rounded-xl px-4 py-3 text-sm text-white focus:border-[#8d6e63] outline-none transition-all"
                      value={tempGithubConfig.repo}
                      onChange={(e) => setTempGithubConfig({ ...tempGithubConfig, repo: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8d6e63] uppercase tracking-widest mb-2">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    placeholder="ghp_************************************"
                    className="w-full bg-[#1e1915] border border-[#3e2723] rounded-xl px-4 py-3 text-sm text-white focus:border-[#8d6e63] outline-none transition-all font-mono"
                    value={tempGithubConfig.pat}
                    onChange={(e) => setTempGithubConfig({ ...tempGithubConfig, pat: e.target.value })}
                  />
                  <p className="mt-2 text-[10px] text-[#8d6e63]/60 italic font-serif">
                    ※ 閲覧のみの場合はリポジトリが公開なら空でも可。小説の追加・更新には `repo` 権限制御が必要です。
                  </p>
                </div>

                {/* レスポンシブ対応の保存ボタン */}
                <div className="pt-6 border-t border-[#3e2723] flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      setGithubConfig(tempGithubConfig);
                      setViewMode('library');
                    }}
                    className="flex-1 bg-[#8d6e63] hover:bg-[#795548] text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                  >
                    設定を保存して戻る
                  </button>
                  <button
                    onClick={() => {
                      setTempGithubConfig(githubConfig);
                      setViewMode('library');
                    }}
                    className="flex-1 bg-transparent text-[#8d6e63] hover:text-[#a1887f] font-bold py-4 rounded-xl transition-all border border-[#3e2723] sm:border-transparent"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </section>

            <footer className="text-center p-8 opacity-30 text-xs font-serif italic">
              Tsunovel Reader v5.1 - Prototype
            </footer>
          </main>
        </div>
      )}

      {/* --- Add / Search Modal --- */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                {addMode === 'search' ? (
                  <>
                    <Search size={18} className="text-indigo-600" />
                    小説を検索
                  </>
                ) : (
                  <>
                    <Link size={18} className="text-indigo-600" />
                    URLから追加
                  </>
                )}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* タブ切り替え */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setAddMode('search');
                  setUrlInput('');
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${addMode === 'search'
                  ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Search size={16} className="inline mr-2" />
                検索
              </button>
              <button
                onClick={() => {
                  setAddMode('url');
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${addMode === 'url'
                  ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Link size={16} className="inline mr-2" />
                URL
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-white">
              {addMode === 'search' ? (
                <>
                  <div className="relative mb-6">
                    <input
                      type="text"
                      placeholder="キーワードを入力..."
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-gray-50 text-gray-900 placeholder:text-gray-400"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      autoFocus
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                  </div>

                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-12 opacity-40">
                      <Loader className="animate-spin mb-3" size={24} />
                      <p className="text-sm italic font-serif">なろう内を検索中...</p>
                    </div>
                  ) : searchQuery && searchResults.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      検索結果が見つかりませんでした
                    </div>
                  ) : null}

                  {!isSearching && searchResults.length > 0 && (
                    <div className="space-y-3">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => addFromSearch(item)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer group border border-transparent hover:border-gray-200 transition-all"
                        >
                          <div
                            className="w-10 h-14 bg-gray-200 rounded flex-shrink-0 bg-cover bg-center shadow-sm"
                            style={{ backgroundImage: `url(https://picsum.photos/seed/${idx + 100}/100/150)` }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">{item.author}</p>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.desc}</p>
                          </div>
                          <Plus size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      小説のURLを入力
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        placeholder="https://ncode.syosetu.com/..."
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-gray-50 text-gray-900 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUrlDownload()}
                        disabled={isDownloading}
                        autoFocus
                      />
                      <Link className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      対応サイト: 小説家になろう (GitHub Actionsプロキシ経由)
                    </p>
                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Coffee className="text-indigo-600" size={20} />
                        <div>
                          <p className="text-xs font-bold text-indigo-900">なろうランキングから探す</p>
                          <p className="text-[10px] text-indigo-700 opacity-70">人気の作品をチェックしましょう</p>
                        </div>
                      </div>
                      <button
                        onClick={() => window.open('https://yomou.syosetu.com/rank/top/', '_blank')}
                        className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm hover:shadow-md transition-all active:scale-95 border border-indigo-100"
                      >
                        開く
                      </button>
                    </div>
                  </div>

                  {downloadProgress && (
                    <div className={`mb-4 p-3 rounded-lg border ${downloadProgress.startsWith('エラー:')
                      ? 'bg-red-50 border-red-200'
                      : 'bg-blue-50 border-blue-200'
                      }`}>
                      <div className={`flex items-center gap-2 text-sm ${downloadProgress.startsWith('エラー:')
                        ? 'text-red-700'
                        : 'text-blue-700'
                        }`}>
                        {isDownloading && !downloadProgress.startsWith('エラー:') && (
                          <Loader size={16} className="animate-spin" />
                        )}
                        <span className="flex-1">{downloadProgress}</span>
                      </div>
                      {downloadProgress.startsWith('エラー:') && (
                        <div className="mt-2 text-xs text-red-600">
                          <p>考えられる原因:</p>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>バックエンドAPIが設定されていない</li>
                            <li>API URLが正しくない</li>
                            <li>ネットワークエラー</li>
                            <li>URLが無効</li>
                          </ul>
                          <p className="mt-2">詳細はブラウザのコンソール（F12）を確認してください。</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleUrlDownload}
                    disabled={!urlInput.trim() || isDownloading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <Loader size={18} className="animate-spin" />
                        <span>ダウンロード中...</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span>小説をダウンロード</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

