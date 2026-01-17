# プロジェクトの問題管理 (Issues)

## [Closed] IndexedDB使用時にリロードするとダウンロード進捗が0%になる

**問題内容:**
オフラインストレージをIndexedDBに設定している際、ダウンロード中に進捗が表示されるが、ページをリロードすると進捗が0%に戻ってしまう。localStorageでは正常に表示されるため、IndexedDB使用時の進捗状況読み取り機能に不備があると思われる。

**原因:**

1. `getDownloadStatus` 関数が同期関数であり、`localStorage` の値を直接見に行っていたため、IndexedDBに保存されたデータを検知できなかった。
2. リロード時に `downloadStatuses` キャッシュがクリアされるが、IndexedDBの非同期読み込みが完了する前に表示が行われ、フォールバックで0%（localStorageチェックの結果）が表示されていた。
3. 全チャプターの存在チェックを1つずつ `chapterExists` で行っていたため、特に IndexedDB ではオーバーヘッドが大きく、表示の更新が遅れていた。

**対応内容:**

1. `src/utils/offlineStorage.js` に `getDownloadedChapterNumbers` 関数を追加。IndexedDBのインデックスを活用して、ダウンロード済みのチャプター番号を一括で高速に取得できるようにした。
2. `src/App.jsx` の `updateDownloadStatusCache` を改善し、上記の一括取得関数を利用することで進捗更新のパフォーマンスを向上させた。
3. `getDownloadStatus` を修正し、現在のストレージ設定（IndexedDB/localStorage）を考慮するように変更。また、キャッシュがない場合に自動的に非同期でのステータス更新をスケジュールするようにした。

**ステータス:** 完了 (2026-01-18)
