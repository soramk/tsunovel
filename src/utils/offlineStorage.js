/**
 * Offline Storage Manager
 * Supports both localStorage and IndexedDB for offline chapter storage
 * 
 * ストレージオプションの比較:
 * 
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ localStorage    │ 容量: 5-10MB (ブラウザにより異なる)                     │
 * │                 │ 特徴: シンプル、同期的、小規模データ向け                │
 * │                 │ 推奨: 短編小説、数十話程度                             │
 * │                 │ 欠点: 容量制限が厳しい、大量データで遅くなる           │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ IndexedDB       │ 容量: 50MB-無制限 (利用可能ディスク容量の最大50%程度)  │
 * │                 │ 特徴: 非同期、大規模データ向け、高速検索               │
 * │                 │ 推奨: 長編小説、数百話以上                             │
 * │                 │ 欠点: APIがやや複雑 (本モジュールで抽象化済み)         │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 * 
 * ブラウザ別 IndexedDB 容量目安:
 * - Chrome: ディスク容量の最大80%、オリジンごとに最大60%
 * - Firefox: ディスク容量の最大50%、オリジンごとに最大2GB
 * - Safari: 初回1GB、ユーザー許可で拡張可能
 * - Edge: Chromeと同様
 */

const DB_NAME = 'tsunovel_offline';
const DB_VERSION = 1;
const STORE_NAME = 'chapters';

let dbInstance = null;

/**
 * Storage type constants
 */
export const STORAGE_TYPES = {
    LOCAL_STORAGE: 'localStorage',
    INDEXED_DB: 'indexedDB'
};

/**
 * Storage information for display in settings
 */
export const STORAGE_INFO = {
    [STORAGE_TYPES.LOCAL_STORAGE]: {
        name: 'localStorage',
        displayName: 'ローカルストレージ',
        capacity: '5-10MB',
        description: 'シンプルで互換性が高い。短編小説や数十話程度の作品向け。',
        pros: ['すべてのブラウザで利用可能', '設定が簡単'],
        cons: ['容量制限が厳しい (5-10MB)', '大量データで動作が遅くなる'],
        recommended: '短編・中編小説向け'
    },
    [STORAGE_TYPES.INDEXED_DB]: {
        name: 'IndexedDB',
        displayName: 'IndexedDB',
        capacity: '50MB〜数GB',
        description: '大容量対応。長編小説や数百話以上の作品を保存可能。',
        pros: ['大容量 (数百MB〜数GB)', '高速なデータアクセス', '非同期処理で画面がフリーズしない'],
        cons: ['一部の古いブラウザでは利用不可'],
        recommended: '長編小説・大量ダウンロード向け'
    }
};

/**
 * Initialize IndexedDB
 */
const initDB = () => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('ncode', 'ncode', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

/**
 * Check if IndexedDB is available
 */
export const isIndexedDBAvailable = () => {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
        return false;
    }
};

/**
 * Get current storage type from settings
 */
export const getStorageType = () => {
    try {
        const saved = localStorage.getItem('tsunovel_storage_type');
        if (saved && Object.values(STORAGE_TYPES).includes(saved)) {
            // If IndexedDB is selected but not available, fall back to localStorage
            if (saved === STORAGE_TYPES.INDEXED_DB && !isIndexedDBAvailable()) {
                return STORAGE_TYPES.LOCAL_STORAGE;
            }
            return saved;
        }
    } catch (e) {
        console.error('Failed to get storage type:', e);
    }
    // Default to IndexedDB if available, otherwise localStorage
    return isIndexedDBAvailable() ? STORAGE_TYPES.INDEXED_DB : STORAGE_TYPES.LOCAL_STORAGE;
};

/**
 * Set storage type
 */
export const setStorageType = (type) => {
    try {
        if (Object.values(STORAGE_TYPES).includes(type)) {
            localStorage.setItem('tsunovel_storage_type', type);
            return true;
        }
    } catch (e) {
        console.error('Failed to set storage type:', e);
    }
    return false;
};

/**
 * Generate storage key
 */
const getStorageKey = (ncode, chapterNum) => {
    return `tsunovel_offline_${ncode.toLowerCase()}_${chapterNum}`;
};

/**
 * Save chapter to localStorage
 */
const saveToLocalStorage = (ncode, chapterNum, content, title) => {
    try {
        const key = getStorageKey(ncode, chapterNum);
        const data = { content, title, timestamp: Date.now() };
        localStorage.setItem(key, JSON.stringify(data));
        return { success: true, quotaExceeded: false };
    } catch (e) {
        const isQuotaError = e.name === 'QuotaExceededError' ||
            (e.message && (e.message.includes('quota') || e.message.includes('storage'))) ||
            e.code === 22 ||
            e.code === 1014;
        console.error('Failed to save to localStorage:', e);
        return { success: false, quotaExceeded: isQuotaError };
    }
};

/**
 * Load chapter from localStorage
 */
const loadFromLocalStorage = (ncode, chapterNum) => {
    try {
        const key = getStorageKey(ncode, chapterNum);
        const saved = localStorage.getItem(key);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
    return null;
};

/**
 * Check if chapter exists in localStorage
 */
const existsInLocalStorage = (ncode, chapterNum) => {
    const key = getStorageKey(ncode, chapterNum);
    return localStorage.getItem(key) !== null;
};

/**
 * Delete chapter from localStorage
 */
const deleteFromLocalStorage = (ncode, chapterNum) => {
    try {
        const key = getStorageKey(ncode, chapterNum);
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('Failed to delete from localStorage:', e);
        return false;
    }
};

/**
 * Save chapter to IndexedDB
 */
const saveToIndexedDB = async (ncode, chapterNum, content, title) => {
    try {
        const db = await initDB();
        const id = getStorageKey(ncode, chapterNum);
        const data = {
            id,
            ncode: ncode.toLowerCase(),
            chapterNum,
            content,
            title,
            timestamp: Date.now()
        };

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data);

            request.onsuccess = () => {
                resolve({ success: true, quotaExceeded: false });
            };

            request.onerror = () => {
                const isQuotaError = request.error?.name === 'QuotaExceededError';
                console.error('Failed to save to IndexedDB:', request.error);
                resolve({ success: false, quotaExceeded: isQuotaError });
            };
        });
    } catch (e) {
        console.error('Failed to save to IndexedDB:', e);
        return { success: false, quotaExceeded: false };
    }
};

/**
 * Load chapter from IndexedDB
 */
const loadFromIndexedDB = async (ncode, chapterNum) => {
    try {
        const db = await initDB();
        const id = getStorageKey(ncode, chapterNum);

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    resolve({
                        content: request.result.content,
                        title: request.result.title,
                        timestamp: request.result.timestamp
                    });
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('Failed to load from IndexedDB:', request.error);
                resolve(null);
            };
        });
    } catch (e) {
        console.error('Failed to load from IndexedDB:', e);
        return null;
    }
};

/**
 * Check if chapter exists in IndexedDB
 */
const existsInIndexedDB = async (ncode, chapterNum) => {
    try {
        const db = await initDB();
        const id = getStorageKey(ncode, chapterNum);

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count(IDBKeyRange.only(id));

            request.onsuccess = () => {
                resolve(request.result > 0);
            };

            request.onerror = () => {
                resolve(false);
            };
        });
    } catch (e) {
        return false;
    }
};

/**
 * Delete chapter from IndexedDB
 */
const deleteFromIndexedDB = async (ncode, chapterNum) => {
    try {
        const db = await initDB();
        const id = getStorageKey(ncode, chapterNum);

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to delete from IndexedDB:', request.error);
                resolve(false);
            };
        });
    } catch (e) {
        console.error('Failed to delete from IndexedDB:', e);
        return false;
    }
};

/**
 * Delete all chapters for a novel from IndexedDB
 */
const deleteAllFromIndexedDB = async (ncode) => {
    try {
        const db = await initDB();
        const ncodeLower = ncode.toLowerCase();

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('ncode');
            const request = index.openCursor(IDBKeyRange.only(ncodeLower));
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    deletedCount++;
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                console.error('Failed to delete all from IndexedDB:', request.error);
                resolve(0);
            };
        });
    } catch (e) {
        console.error('Failed to delete all from IndexedDB:', e);
        return 0;
    }
};

/**
 * Get count of downloaded chapters for a novel from IndexedDB
 */
const getDownloadedCountFromIndexedDB = async (ncode) => {
    try {
        const db = await initDB();
        const ncodeLower = ncode.toLowerCase();

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('ncode');
            const request = index.count(IDBKeyRange.only(ncodeLower));

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                resolve(0);
            };
        });
    } catch (e) {
        return 0;
    }
};

/**
 * Get list of downloaded chapter numbers for a novel from IndexedDB
 */
const getDownloadedChaptersFromIndexedDB = async (ncode) => {
    try {
        const db = await initDB();
        const ncodeLower = ncode.toLowerCase();

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('ncode');
            const request = index.openCursor(IDBKeyRange.only(ncodeLower));
            const chapters = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Extract chapter number from ID (tsunovel_offline_{ncode}_{chapterNum})
                    const id = cursor.primaryKey;
                    const parts = id.split('_');
                    const chapterNum = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(chapterNum)) {
                        chapters.push(chapterNum);
                    }
                    cursor.continue();
                } else {
                    resolve(chapters);
                }
            };

            request.onerror = () => {
                resolve([]);
            };
        });
    } catch (e) {
        return [];
    }
};

// ============================================================
// Public API - Unified interface that automatically uses the selected storage
// ============================================================

/**
 * Save chapter to the current storage
 * @param {string} ncode - Novel code
 * @param {number} chapterNum - Chapter number
 * @param {string} content - Chapter content
 * @param {string} title - Chapter title
 * @returns {Promise<{success: boolean, quotaExceeded: boolean}>}
 */
export const saveChapter = async (ncode, chapterNum, content, title) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await saveToIndexedDB(ncode, chapterNum, content, title);
    } else {
        return saveToLocalStorage(ncode, chapterNum, content, title);
    }
};

/**
 * Load chapter from the current storage
 * @param {string} ncode - Novel code
 * @param {number} chapterNum - Chapter number
 * @returns {Promise<{content: string, title: string, timestamp: number}|null>}
 */
export const loadChapter = async (ncode, chapterNum) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await loadFromIndexedDB(ncode, chapterNum);
    } else {
        return loadFromLocalStorage(ncode, chapterNum);
    }
};

/**
 * Check if chapter exists in the current storage
 * @param {string} ncode - Novel code
 * @param {number} chapterNum - Chapter number
 * @returns {Promise<boolean>}
 */
export const chapterExists = async (ncode, chapterNum) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await existsInIndexedDB(ncode, chapterNum);
    } else {
        return existsInLocalStorage(ncode, chapterNum);
    }
};

/**
 * Delete chapter from the current storage
 * @param {string} ncode - Novel code
 * @param {number} chapterNum - Chapter number
 * @returns {Promise<boolean>}
 */
export const deleteChapter = async (ncode, chapterNum) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await deleteFromIndexedDB(ncode, chapterNum);
    } else {
        return deleteFromLocalStorage(ncode, chapterNum);
    }
};

/**
 * Delete all offline data for a novel
 * @param {string} ncode - Novel code
 * @param {number} totalChapters - Total number of chapters
 * @returns {Promise<number>} - Number of deleted chapters
 */
export const deleteAllChapters = async (ncode, totalChapters) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await deleteAllFromIndexedDB(ncode);
    } else {
        // localStorage: delete each chapter
        let deletedCount = 0;
        for (let i = 1; i <= totalChapters; i++) {
            if (deleteFromLocalStorage(ncode, i)) {
                deletedCount++;
            }
        }
        return deletedCount;
    }
};

/**
 * Check storage space availability
 * @returns {Promise<boolean>}
 */
export const checkStorageSpace = async () => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        // IndexedDB: Try to estimate storage
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const usedPercent = (estimate.usage / estimate.quota) * 100;
                return usedPercent < 90; // Return false if >90% used
            } catch (e) {
                return true; // Assume OK if can't estimate
            }
        }
        return true;
    } else {
        // localStorage: Test write
        try {
            const testKey = '__storage_test__';
            const testData = 'x'.repeat(10000);
            localStorage.setItem(testKey, testData);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }
};

/**
 * Get storage usage statistics
 * @returns {Promise<{used: number, quota: number, usedFormatted: string, quotaFormatted: string, percentage: number}>}
 */
export const getStorageStats = async () => {
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB && navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                quota: estimate.quota || 0,
                usedFormatted: formatBytes(estimate.usage || 0),
                quotaFormatted: formatBytes(estimate.quota || 0),
                percentage: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
            };
        } catch (e) {
            return { used: 0, quota: 0, usedFormatted: '不明', quotaFormatted: '不明', percentage: 0 };
        }
    } else {
        // localStorage: Estimate based on stored data
        let totalSize = 0;
        try {
            for (const key in localStorage) {
                if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
                    totalSize += localStorage.getItem(key).length * 2; // UTF-16
                }
            }
        } catch (e) {
            // Ignore errors
        }
        const quotaEstimate = 5 * 1024 * 1024; // 5MB estimate
        return {
            used: totalSize,
            quota: quotaEstimate,
            usedFormatted: formatBytes(totalSize),
            quotaFormatted: '約5MB',
            percentage: Math.round((totalSize / quotaEstimate) * 100)
        };
    }
};

/**
 * Migrate data from localStorage to IndexedDB (for users switching storage types)
 * @param {function} progressCallback - Called with progress updates
 * @returns {Promise<{migrated: number, failed: number}>}
 */
export const migrateToIndexedDB = async (progressCallback) => {
    const prefix = 'tsunovel_offline_';
    const keys = [];

    // Find all offline data keys
    for (const key in localStorage) {
        if (key.startsWith(prefix)) {
            keys.push(key);
        }
    }

    let migrated = 0;
    let failed = 0;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        try {
            const data = JSON.parse(localStorage.getItem(key));
            // Parse key: tsunovel_offline_{ncode}_{chapterNum}
            const keyParts = key.replace(prefix, '').split('_');
            const chapterNum = parseInt(keyParts.pop(), 10);
            const ncode = keyParts.join('_');

            const result = await saveToIndexedDB(ncode, chapterNum, data.content, data.title);
            if (result.success) {
                migrated++;
            } else {
                failed++;
            }
        } catch (e) {
            failed++;
        }

        if (progressCallback) {
            progressCallback({ current: i + 1, total: keys.length, migrated, failed });
        }
    }

    return { migrated, failed };
};

/**
 * Get downloaded chapter count for the current storage
 * @param {string} ncode - Novel code
 * @returns {Promise<number>}
 */
export const getDownloadedChapterCount = async (ncode) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await getDownloadedCountFromIndexedDB(ncode);
    } else {
        const prefix = `tsunovel_offline_${ncode.toLowerCase()}_`;
        let count = 0;
        for (const key in localStorage) {
            if (key.startsWith(prefix)) {
                count++;
            }
        }
        return count;
    }
};

/**
 * Get list of downloaded chapter numbers for the current storage
 * @param {string} ncode - Novel code
 * @returns {Promise<number[]>}
 */
export const getDownloadedChapterNumbers = async (ncode) => {
    const storageType = getStorageType();

    if (storageType === STORAGE_TYPES.INDEXED_DB) {
        return await getDownloadedChaptersFromIndexedDB(ncode);
    } else {
        const prefix = `tsunovel_offline_${ncode.toLowerCase()}_`;
        const chapters = [];
        for (const key in localStorage) {
            if (key.startsWith(prefix)) {
                const parts = key.split('_');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num)) chapters.push(num);
            }
        }
        return chapters.sort((a, b) => a - b);
    }
};
