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
  Loader
} from 'lucide-react';
import { fetchNovelContent, extractNcode } from './utils/novelFetcher';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addMode, setAddMode] = useState('search'); // 'search' or 'url'
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [githubConfig, setGithubConfig] = useState({
    owner: 'soramk', // デフォルト値を修正
    repo: 'tsunovel',
    pat: '',
  });

  const [readerSettings, setReaderSettings] = useState({
    theme: 'sepia',
    fontSize: 'medium',
    fontFamily: 'serif',
  });

  const [currentChapter, setCurrentChapter] = useState(1);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);

  const settingsRef = useRef(null);

  // 初期読み込み: docs/index.json から小説一覧を取得
  useEffect(() => {
    const loadIndex = async () => {
      const index = await fetchIndex(githubConfig);
      if (index && index.length > 0) {
        const loadedNovels = index.map(item => ({
          id: item.ncode,
          title: item.title,
          author: item.writer,
          site: '小説家になろう',
          status: 'unread',
          progress: 0,
          ncode: item.ncode,
          content: null // 後で取得
        }));
        setNovels(loadedNovels);
      }
    };
    loadIndex();
  }, []);

  // 設定パネルの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // 本を開くアニメーション処理
  const handleBookClick = async (novelId) => {
    if (openingBookId) return;

    const novel = novels.find(n => n.id === novelId);

    // コンテンツが未取得の場合は取得する
    if (novel && !novel.content) {
      setOpeningBookId(novelId);
      await loadChapter(novelId, 1);
    } else {
      setOpeningBookId(novelId);
      setCurrentChapter(1);
    }

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
  const loadChapter = async (novelId, chapterNum) => {
    const novel = novels.find(n => n.id === novelId);
    if (!novel) return;

    setIsLoadingChapter(true);
    try {
      // 1. chapters/{n}.txt の取得を試みる
      const chapterUrl = `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/main/storage/${novel.ncode}/chapters/${chapterNum}.txt?t=${Date.now()}`;
      const infoUrl = `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/main/storage/${novel.ncode}/info.json?t=${Date.now()}`;

      let novelContent = '';
      let infoData = novel.info || null;

      const contentRes = await fetch(chapterUrl);
      if (contentRes.ok) {
        novelContent = await contentRes.text();
      } else if (chapterNum === 1) {
        // 互換性のため content.txt も試す
        const legacyUrl = `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/main/storage/${novel.ncode}/content.txt?t=${Date.now()}`;
        const legacyRes = await fetch(legacyUrl);
        if (legacyRes.ok) novelContent = await legacyRes.text();
      }

      if (!infoData) {
        const infoRes = await fetch(infoUrl);
        if (infoRes.ok) infoData = await infoRes.json();
      }

      setNovels(prev => prev.map(n =>
        n.id === novelId ? {
          ...n,
          content: novelContent || (chapterNum === 1 ? (infoData?.story ? `【あらすじ】\n\n${infoData.story}` : '本文を取得できませんでした。') : '指定された話数はまだ取得されていません。'),
          info: infoData
        } : n
      ));
      setCurrentChapter(chapterNum);
    } catch (error) {
      console.error('Error loading chapter:', error);
    } finally {
      setIsLoadingChapter(false);
    }
  };

  const nextChapter = () => {
    const novel = novels.find(n => n.id === currentNovelId);
    if (novel && novel.info && currentChapter < novel.info.general_allcount) {
      loadChapter(currentNovelId, currentChapter + 1);
    }
  };

  const prevChapter = () => {
    if (currentChapter > 1) {
      loadChapter(currentNovelId, currentChapter - 1);
    }
  };


  const closeReader = () => {
    setViewMode('library');
    setCurrentNovelId(null);
    setIsSettingsOpen(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = MOCK_SEARCH_DB.filter(item =>
      item.title.includes(query) || item.author.includes(query) || item.keyword.includes(query.toLowerCase())
    );
    setSearchResults(results);
  };

  const addFromSearch = (item) => {
    const newNovel = {
      id: Date.now(),
      title: item.title,
      author: item.author,
      site: item.site,
      status: 'unread',
      progress: 0,
      content: `${item.title}\n\n（本文サンプル）\n\n${item.desc}\n\n　これは検索から追加された小説のサンプルコンテンツです。実際のアプリケーションでは、ここに実際の小説の本文が表示されます。`
    };
    setNovels([newNovel, ...novels]);
    setIsAddModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
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
    const base = "max-w-3xl mx-auto p-8 min-h-screen transition-colors duration-300 leading-loose";
    let themeClass = "";
    let fontClass = readerSettings.fontFamily === 'serif' ? "font-serif" : "font-sans";
    let sizeClass = "";

    switch (readerSettings.theme) {
      case 'dark': themeClass = "bg-gray-900 text-gray-300"; break;
      case 'sepia': themeClass = "bg-[#f4ecd8] text-[#5b4636]"; break;
      default: themeClass = "bg-white text-gray-900"; break;
    }
    switch (readerSettings.fontSize) {
      case 'small': sizeClass = "text-sm"; break;
      case 'large': sizeClass = "text-xl"; break;
      default: sizeClass = "text-base"; break;
    }
    return `${base} ${themeClass} ${fontClass} ${sizeClass}`;
  };

  return (
    <div className="min-h-screen bg-[#2c241b] text-gray-100 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">

      {/* --- Library Mode --- */}
      {viewMode === 'library' && (
        <>
          <header className="bg-[#1e1915] text-[#d7ccc8] shadow-2xl sticky top-0 z-30 border-b border-[#3e2723]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-[#4e342e] p-1.5 rounded-lg shadow-inner border border-[#5d4037]">
                  <Book size={20} className="text-[#d7ccc8]" />
                </div>
                <h1 className="text-xl font-bold tracking-wider font-serif">Tsunovel</h1>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#8d6e63] hover:bg-[#795548] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 border border-[#a1887f]"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">小説を追加</span>
              </button>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 py-12 relative min-h-[calc(100vh-64px)]">

            <div className="mb-10 flex items-end gap-4 px-2">
              <h2 className="font-serif text-3xl font-bold text-[#d7ccc8] drop-shadow-md">My Bookshelf</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#d7ccc8]/30 to-transparent mb-2"></div>
            </div>

            {/* Bookshelf Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-20 px-4 pb-20">
              {novels.map((novel, index) => {
                const isOpening = openingBookId === novel.id;
                // 画像URLを固定IDで生成
                const coverImage = `https://picsum.photos/seed/${novel.id + 200}/300/450`;

                return (
                  <div
                    key={novel.id}
                    className={`relative group perspective-1000 ${isOpening ? 'z-50' : 'z-0'}`}
                  >

                    {/* --- 3D BOOK STRUCTURE --- */}
                    <div
                      onClick={() => handleBookClick(novel.id)}
                      className={`
                        relative w-full aspect-[2/3] cursor-pointer preserve-3d ease-in-out
                        ${isOpening ? 'duration-[800ms]' : 'duration-300'}
                        ${isOpening
                          ? 'translate-z-[200px] -translate-y-[50px] scale-110 rotate-y-[-10deg]'
                          : 'group-hover:translate-z-[30px] group-hover:-translate-y-[10px] group-hover:rotate-y-[-5deg]'
                        }
                      `}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* 1. FRONT COVER (表紙) */}
                      <div
                        className={`
                          absolute inset-0 rounded-r-sm rounded-l-sm shadow-2xl origin-left backface-hidden z-20
                          transition-transform ease-in-out border border-white/10
                          ${isOpening ? 'duration-[800ms] delay-[400ms] rotate-y-[-140deg]' : 'duration-300'}
                        `}
                        style={{
                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.1)), url(${coverImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: '#3e2e28'
                        }}
                      >
                        {/* 質感と影 */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/20 mix-blend-multiply rounded-sm"></div>
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20"></div>

                        {/* タイトルデザイン */}
                        <div className="relative h-full p-4 flex flex-col justify-between z-30">
                          <div className="border border-[#e0d0c0]/30 p-1 h-full flex flex-col backdrop-blur-[0.5px]">
                            <div className="border border-[#e0d0c0]/20 flex-1 p-2 flex flex-col bg-black/10">
                              <span className="text-[10px] tracking-widest text-[#e0d0c0]/80 uppercase mb-2 border-b border-[#e0d0c0]/20 pb-1 self-start">{novel.site}</span>
                              <h3 className="font-serif font-bold text-white text-lg leading-snug drop-shadow-md line-clamp-4 filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                {novel.title}
                              </h3>
                              <p className="mt-auto text-xs text-[#e0d0c0] font-medium text-right drop-shadow-sm">
                                {novel.author}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ステータスリボン */}
                        {novel.status === 'reading' && (
                          <div className="absolute -top-1 right-3 w-5 h-8 bg-gradient-to-b from-red-700 to-red-600 shadow-md flex items-end justify-center pb-1 z-40">
                            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#f3f0e9] absolute bottom-[-8px]"></div>
                          </div>
                        )}
                        {novel.status === 'completed' && (
                          <div className="absolute -top-1 right-3 w-5 h-8 bg-gradient-to-b from-green-700 to-green-600 shadow-md flex items-end justify-center pb-1 z-40">
                            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#f3f0e9] absolute bottom-[-8px]"></div>
                          </div>
                        )}
                      </div>

                      {/* 2. PAGE BLOCK (中身・厚み) */}
                      <div className="absolute inset-y-[1%] right-[1%] w-[98%] bg-[#fdfbf7] rounded-l-sm -translate-z-[4px] z-10">
                        <div
                          className="h-full w-full rounded-r-sm border-r border-gray-300 shadow-inner"
                          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #e0e0e0, #e0e0e0 1px, #fff 1px, #fff 3px)' }}
                        ></div>
                      </div>

                      {/* 3. INSIDE COVER (表紙の裏) */}
                      <div
                        className={`
                           absolute inset-0 bg-[#fffefc] rounded-r-sm rounded-l-sm origin-left backface-hidden z-10 flex items-center justify-center p-4
                           transition-transform ease-in-out border-l border-gray-200
                           ${isOpening ? 'duration-[800ms] delay-[400ms] rotate-y-[-140deg]' : 'duration-300'}
                        `}
                        style={{ transform: `rotateY(180deg)` }}
                      >
                        <div className="text-center opacity-70 w-full">
                          <div className="border-4 border-double border-gray-300 p-4 m-2">
                            <p className="font-serif text-gray-800 text-sm italic mb-2 line-clamp-2">{novel.title}</p>
                            <div className="w-full h-[1px] bg-gray-300 mx-auto my-2"></div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tsunovel Library</p>
                          </div>
                        </div>
                      </div>

                      {/* 4. BACK COVER (裏表紙) */}
                      <div className="absolute inset-0 bg-[#3e2e28] rounded-sm -translate-z-[14px] shadow-2xl border border-white/5"></div>

                      {/* 5. SPINE (背表紙) */}
                      <div className="absolute left-0 top-0 bottom-0 w-[14px] bg-[#2d211b] origin-left rotate-y-[-90deg] flex items-center justify-center overflow-hidden border-l border-white/10">
                        <span className="text-[8px] text-gray-400 rotate-90 whitespace-nowrap opacity-50 tracking-widest">{novel.author}</span>
                      </div>

                    </div>

                    {/* 床の影 */}
                    <div className={`
                      absolute -bottom-8 left-2 right-2 h-4 bg-black/50 blur-lg rounded-[100%] 
                      transition-all ease-in-out
                      ${isOpening ? 'duration-[800ms] scale-75 opacity-30 translate-y-8' : 'duration-300 group-hover:scale-90 group-hover:opacity-60'}
                    `}></div>

                    {/* --- SHELF BOARD (棚板) --- */}
                    <div className="absolute -bottom-10 -left-6 -right-6 h-6 bg-[#3e2723] rounded-sm shadow-[0_10px_20px_rgba(0,0,0,0.5)] z-[-1]">
                      <div className="absolute top-0 left-0 right-0 h-2 bg-[#4e342e]"></div>
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </>
      )}

      {/* --- Reader Mode --- */}
      {viewMode === 'reader' && (
        <div className="bg-[#f3f0e9] min-h-screen animate-in fade-in duration-1000">
          {/* Header */}
          <div className="fixed top-0 left-0 right-0 h-14 bg-[#f3f0e9]/95 backdrop-blur border-b border-[#e5e0d0] flex items-center justify-between px-4 z-20 transition-all">
            <button onClick={closeReader} className="p-2 text-gray-600 hover:bg-[#e5e0d0] rounded-lg flex items-center gap-2 group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium font-serif">ライブラリに戻る</span>
            </button>
            <div className="text-sm font-bold text-gray-800 font-serif tracking-wide truncate max-w-[200px] sm:max-w-md">
              {novels.find(n => n.id === currentNovelId)?.title}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-2 text-gray-600 hover:bg-[#e5e0d0] rounded-lg"
                >
                  <Settings size={20} />
                </button>
                {isSettingsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-30">
                    <div className="space-y-4">
                      {/* テーマ設定 */}
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">テーマ</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, theme: 'light' })}
                            className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-1 transition-all ${readerSettings.theme === 'light' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                              }`}
                          >
                            <Sun size={16} />
                            <span className="text-xs">ライト</span>
                          </button>
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, theme: 'sepia' })}
                            className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-1 transition-all ${readerSettings.theme === 'sepia' ? 'bg-[#f4ecd8] shadow-sm text-[#5b4636]' : 'text-gray-600'
                              }`}
                          >
                            <Coffee size={16} />
                            <span className="text-xs">セピア</span>
                          </button>
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, theme: 'dark' })}
                            className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-1 transition-all ${readerSettings.theme === 'dark' ? 'bg-gray-700 shadow-sm text-white' : 'text-gray-600'
                              }`}
                          >
                            <Moon size={16} />
                            <span className="text-xs">ダーク</span>
                          </button>
                        </div>
                      </div>

                      {/* フォント設定 */}
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-1">
                          <Type size={14} />
                          フォント
                        </label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontFamily: 'serif' })}
                            className={`flex-1 py-2 rounded-md text-sm transition-all ${readerSettings.fontFamily === 'serif' ? 'bg-white shadow-sm font-serif' : ''
                              }`}
                          >
                            明朝体
                          </button>
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontFamily: 'sans' })}
                            className={`flex-1 py-2 rounded-md text-sm transition-all ${readerSettings.fontFamily === 'sans' ? 'bg-white shadow-sm font-sans' : ''
                              }`}
                          >
                            ゴシック体
                          </button>
                        </div>
                      </div>

                      {/* 文字サイズ設定 */}
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">文字サイズ</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontSize: 'small' })}
                            className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-1 transition-all ${readerSettings.fontSize === 'small' ? 'bg-white shadow-sm' : ''
                              }`}
                          >
                            <Minus size={14} />
                            <span className="text-xs">小</span>
                          </button>
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontSize: 'medium' })}
                            className={`flex-1 py-2 rounded-md text-sm transition-all ${readerSettings.fontSize === 'medium' ? 'bg-white shadow-sm' : ''
                              }`}
                          >
                            <span className="text-xs">中</span>
                          </button>
                          <button
                            onClick={() => setReaderSettings({ ...readerSettings, fontSize: 'large' })}
                            className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-1 transition-all ${readerSettings.fontSize === 'large' ? 'bg-white shadow-sm' : ''
                              }`}
                          >
                            <Maximize size={14} />
                            <span className="text-xs">大</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reader Content */}
          <div className={getReaderStyles()}>
            <div className="max-w-2xl mx-auto pt-20 pb-20">
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

              {isLoadingChapter ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
                  <Loader className="animate-spin" />
                  <p>読み込み中...</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-justify leading-[2.0]">
                  {novels.find(n => n.id === currentNovelId)?.content}
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
                    {currentChapter} / {novels.find(n => n.id === currentNovelId)?.info?.general_allcount || '?'}
                  </span>
                  <button
                    onClick={nextChapter}
                    disabled={currentChapter >= (novels.find(n => n.id === currentNovelId)?.info?.general_allcount || 0)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-current/5 disabled:opacity-20 transition-all font-bold"
                  >
                    次の話
                    <ArrowLeft size={18} className="rotate-180" />
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

                  {searchQuery && searchResults.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      検索結果が見つかりませんでした
                    </div>
                  )}

                  {searchResults.length > 0 && (
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
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">GitHub Repository (Owner/Repo)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="owner"
                            className="w-1/2 px-2 py-1 text-xs rounded border border-gray-200 focus:border-indigo-500 outline-none"
                            value={githubConfig.owner}
                            onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                          />
                          <span className="text-gray-400">/</span>
                          <input
                            type="text"
                            placeholder="repo"
                            className="w-1/2 px-2 py-1 text-xs rounded border border-gray-200 focus:border-indigo-500 outline-none"
                            value={githubConfig.repo}
                            onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">GitHub PAT (個人アクセストークン)</label>
                        <input
                          type="password"
                          placeholder="ghp_..."
                          className="w-full px-3 py-2 text-xs rounded border border-gray-200 focus:border-indigo-500 outline-none"
                          value={githubConfig.pat}
                          onChange={(e) => setGithubConfig({ ...githubConfig, pat: e.target.value })}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        ※ `repo` 権限が必要です。変更をGitHubにPushした状態で実行してください。
                      </p>
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

