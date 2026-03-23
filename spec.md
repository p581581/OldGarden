# 老園丁窯烤麵包 - Vercel 全端開發規格書 (整合最終版)

## 1. 視覺與前端規範 (UI/UX)
- **網頁圖示 (Favicon)**: 網頁分頁標題旁需使用太陽花符號 🌻 (建議透過 `data:image/svg+xml` 實作於 HTML Header)。
- **商品照片顯示順位 (Image Fallback Logic)**:
    渲染商品卡片時，前端必須依序檢查並顯示：
    1. **Vercel Blob**: 優先讀取並顯示儲存在 Blob 的圖片。
    2. **Image URL**: 若 Blob 無效，則嘗試讀取商品資料中的 `url` 欄位連結。
    3. **顯示商品名稱 (Text)**: 若上述皆無圖片，則以背景色塊直接顯示 **「該商品名稱」** 文字作為保底。

---

## 2. 儲存架構與資料格式 (Storage & Schema)

### A. 儲存服務 (Vercel Services)
- **Vercel Blob**: 
    1. **Products Metadata**: 儲存 `products.json` 檔案，紀錄所有商品的詳細資訊。
    2. **Image Files**: 儲存實體圖片檔案（單檔上限 5MB）。
- **Vercel KV**: 儲存「複製按鈕」觸發的訂單統計日誌 (`order_logs`)。

### B. 商品資料欄位 (Product Fields)
每個商品必須包含以下紀錄：
- `id`: 唯一識別碼
- `name`: 商品名稱
- `weight`: 重量
- `price`: 價格
- `url`: 外部圖片網址 (用於 Fallback 第 2 順位)
- `imagePath`: Vercel Blob 中的圖片路徑 (用於 Fallback 第 1 順位)
- `desc`: 商品描述

---

## 3. 認證與管理員系統 (Auth & Admin)
- **環境變數**: 於 Vercel 設定中預設 `ADMIN_USER` 與 `ADMIN_PASS`。
- **登入頁面 (Login Page)**:
    - 管理員需輸入帳密進行驗證。
    - **驗證機制**: 驗證成功後核發 Token，有效期為 **3 天 (72 小時)**。
    - 前端需將 Token 存於 `localStorage`，進入 `admin.html` 時自動檢查。
    - 未登入或 Token 過期者應自動導回登入頁。

---

## 4. API 規格定義 (Express /api/index.js)


### 1. 產品管理 API (Product API)
負責所有麵包品項的 CRUD 操作。資料儲存在 Vercel KV 的 `bakery_products` 鍵值中。

* **GET `/api/products`**
    * **描述**: 取得所有產品清單。
    * **邏輯**: 若 KV 資料庫為空，需自動初始化 (Seed) 原始 5 款麵包資料。
* **POST `/api/products`**
    * **描述**: 新增或更新產品（包含上傳圖片至 Blob 並更新 `products.json`）。
    * **權限**: 需驗證管理員身分。
* **PUT `/api/products/:id`**
    * **描述**: 更新指定 ID 的產品欄位（如價格、描述、重量）。
    * **權限**: 需驗證管理員身分。
* **DELETE `/api/products/:id`**
    * **描述**: 刪除產品，並同步移除 Vercel Blob 中關聯的圖片。
    * **權限**: 需驗證管理員身分。

### 2. 圖片處理 API (Image & Upload API)
支援產品圖片的上傳與管理。

* **POST `/api/upload`**
    * **描述**: 接受 Multipart 圖片上傳。
    * **限制**: 檔案大小上限 5 MB。
    * **儲存**: 使用 `@vercel/blob` 儲存並回傳公開的圖片網址。
* **GET `/api/images/:key`**
    * **描述**: 提供圖片讀取代理（可選，通常直接使用 Blob URL）。

### 3. 統計數據管理 API (stats API)
統計報表數據。
- **POST `/api/stats/track`**: **數據採集**。每當使用者點擊前端「複製按鈕」時呼叫，紀錄：日期、品項、數量、金額。
- **GET `/api/stats`**: 取得統計報表數據，需支援日期區間篩選。

### 4. 登入驗證 API (stats API)
登入驗證機制。
- **POST `/api/login`**: 比對環境變數，核發 3 天效期的 Token。
---

## 5. 後台統計畫面 (Admin Stats Dashboard)
於 `admin.html` 使用 **Chart.js** 實作以下統計圖表：

### A. 數據篩選器
- **日期區間**: 支援起訖日期篩選，初始預設顯示「當月」。
- **商品類別**: 下拉選單可過濾特定商品。

### B. 設計畫面
1. **圓餅圖 (Pie Chart)**: 統計各商品訂購數量的佔比（以按下複製按鈕之數據為準）。
2. **趨勢曲線圖 (Line Chart)**:
    - **橫軸**: 日期。
    - **縱軸**: 同時繪製「訂購累計總數」與「累計總金額」兩條曲線