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
- **Upstash Redis**（透過 Vercel Marketplace 安裝）。環境變數相容兩種命名：
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN`（舊版 Vercel KV 命名）

  | Redis Key | 用途 | 狀態 |
  |---|---|---|
  | `bakery_products` | 所有商品資料 | 已實作 |
  | `order_logs` | 訂單統計日誌 | 已實作 |
  | `bakery_banner` | Banner 圖片 URL | 已實作 |
  | `bakery_settings` | 全站設定（免運/付款/關於我們） | **待實作** |

- **Vercel Blob**:
    1. **Image Files**: 儲存實體圖片檔案，路徑格式 `images/{timestamp}-{filename}`，單檔上限 5MB，存取權限 `public`。
- ~~**Vercel KV**~~: 已下架。
- ~~**Blob JSON 方案**~~: 改用前曾嘗試以 `products.json` / `logs.json` 儲存於 Blob，因 eventually consistent 有時間差問題而棄用。

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
- **Token 機制**: 自製 HMAC-SHA256 簽章（非 JWT）。格式為 `base64url(payload).hex_sig`，payload 含 `{ user, exp }`。以 `ADMIN_PASS` 作為 HMAC secret，有效期 **72 小時**。
- **登入頁面 (Login Page)**:
    - 管理員需輸入帳密進行驗證。
    - 前端需將 Token 存於 `localStorage`，進入 `admin.html` 時自動檢查。
    - 未登入或 Token 過期者應自動導回登入頁。
- **受保護 API**: 請求需帶 `Authorization: Bearer <token>` Header，由 `adminAuth` middleware 驗證。

---

## 4. API 規格定義 (Express /api/index.js)

> 權限標示：🔓 公開 / 🔒 需 `Authorization: Bearer <token>`

---

### 1. 登入驗證 API

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| POST | `/api/login` | 🔓 | 已實作 |

* **POST `/api/login`**
    * **Body**: `{ user, pass }`
    * **成功回應**: `{ token }` — HMAC-SHA256 簽章 Token，有效 72 小時。
    * **失敗回應**: `401 { error: '帳號或密碼錯誤' }`

---

### 2. 產品管理 API

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| GET | `/api/products` | 🔓 | 已實作 |
| POST | `/api/products` | 🔒 | 已實作 |
| PUT | `/api/products/:id` | 🔒 | 已實作 |
| DELETE | `/api/products/:id` | 🔒 | 已實作 |

* **GET `/api/products`**: 回傳所有產品陣列。若 `bakery_products` 為空自動 Seed 5 筆初始資料。
* **POST `/api/products`**: 新增商品。必填 `name`、`price`；選填 `weight`、`desc`、`url`、`imagePath`。`id` 自動遞增（現有最大 id + 1）。回傳 `201` + 新商品物件。
* **PUT `/api/products/:id`**: 部分更新指定商品欄位（`{ ...existing, ...body, id }` 合併）。找不到回傳 `404`。
* **DELETE `/api/products/:id`**: 刪除商品並呼叫 `del()` 移除 Blob 圖片（`imagePath`）。圖片刪除失敗不阻斷，回傳 `{ success, deleted, imageDeleted }`。

---

### 3. 圖片上傳 API

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| POST | `/api/upload` | 🔒 | 已實作 |
| GET | `/api/images/:key` | 🔓 | 已實作 |

* **POST `/api/upload`**: `multipart/form-data`，欄位名 `image`。上限 5MB，僅接受 `image/*`。存至 Vercel Blob 路徑 `images/{timestamp}-{filename}`，`access: public`。回傳 `{ url }`。
* **GET `/api/images/:key`**: 301 永久重導向至 `https://blob.vercel-storage.com/:key`。

---

### 4. Banner API

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| GET | `/api/banner` | 🔓 | 已實作 |
| PUT | `/api/banner` | 🔒 | 已實作 |

* **GET `/api/banner`**: 回傳 `{ url }`，Redis key `bakery_banner`，無值時回傳空字串。
* **PUT `/api/banner`**: Body `{ url }`，覆寫 `bakery_banner`，回傳 `{ url }`。

---

### 5. 統計數據 API

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| POST | `/api/stats/track` | 🔓 | 已實作 |
| GET | `/api/stats` | 🔒 | 已實作 |

* **POST `/api/stats/track`**: Body `{ items: [{ name, qty, price, amount }], total }`。`items` 必須為陣列，否則回傳 `400`。自動附加 `date`（`YYYY-MM-DD`）與 `timestamp`，append 至 `order_logs`。
* **GET `/api/stats`**: Query 參數：`startDate`、`endDate`（`YYYY-MM-DD`）、`product`（商品名稱）。回傳符合條件的日誌陣列。

---

### 6. 訂單設置 API *(待實作)*

| 方法 | 路徑 | 權限 | 狀態 |
|---|---|---|---|
| GET | `/api/settings` | 🔓 | **待實作** |
| PUT | `/api/settings` | 🔒 | **待實作** |

* **GET `/api/settings`**: 取得全站設定。若 `bakery_settings` 為空回傳預設值（見 Schema）。
* **PUT `/api/settings`**: Body 為完整 settings 物件，整筆覆寫 `bakery_settings`。

#### Settings Schema (`bakery_settings`)
```json
{
  "freeShippingThreshold": 1000,
  "shippingFee": 160,
  "paymentMethods": [
    { "id": "transfer", "name": "網路轉帳 (玉山銀行)", "feeName": "", "fee": 0 },
    { "id": "cod",      "name": "貨到付款",              "feeName": "物流手續費", "fee": 30 }
  ],
  "aboutText": ""
}
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `freeShippingThreshold` | number | 訂單金額達此數值時免運費 |
| `shippingFee` | number | 未達免運門檻時收取的運費 |
| `paymentMethods` | array | 付款方式清單，順序即前端下拉選單順序 |
| `paymentMethods[].id` | string | 唯一識別碼（英數，不可重複） |
| `paymentMethods[].name` | string | 前端顯示名稱 |
| `paymentMethods[].feeName` | string | 手續費說明文字（空字串表示無手續費） |
| `paymentMethods[].fee` | number | 手續費金額（0 表示無） |
| `aboutText` | string | 「關於老園丁」區塊的文字內容，前端直接渲染 |

---

## 5. 後台管理頁面 (admin.html) Tab 結構

### Tab 一覽
| Tab 名稱 | Tab ID | 說明 |
|---|---|---|
| 素材管理 | `tab-banner` | Banner 圖片 + 關於老園丁文字內容 |
| 訂單設置 | `tab-settings` | 免運規則 / 付款方式管理 |
| 商品管理 | `tab-products` | 商品 CRUD |
| 統計報表 | `tab-stats` | Chart.js 統計圖表 |

---

### A. 素材管理 Tab（`tab-banner`）擴充
原有 Banner 上傳功能不變，新增：
- **關於老園丁文字內容**：`<textarea>` 輸入區，儲存至 `bakery_settings.aboutText`。
- 按下「儲存」後呼叫 `PUT /api/settings`，前端 `index.html` 讀取後直接渲染於「關於我們」區塊。

---

### B. 訂單設置 Tab（`tab-settings`，新增）

#### 免運規則
- 輸入欄位：**免運門檻金額**（`freeShippingThreshold`）、**運費**（`shippingFee`）。
- 儲存後前端 `index.html` 呼叫 `GET /api/settings` 取得數值，取代原本 hardcode 的 `1000` 與 `160`。

#### 付款方式管理
- 列出現有付款方式，支援：
  - **新增**：填入 id、顯示名稱、手續費名稱、手續費金額。
  - **編輯**：inline 修改各欄位。
  - **刪除**：移除該筆付款方式。
- 儲存後前端購物車下拉選單（`<select id="paymentMethod">`）動態從 `GET /api/settings` 建立 `<option>`，不再 hardcode。
- 運費說明文字（「滿 N 元免運」）由 `freeShippingThreshold` 動態產生。

---

## 6. 後台統計畫面 (Admin Stats Dashboard)
於 `admin.html` 使用 **Chart.js** 實作以下統計圖表：

### A. 數據篩選器（原 §5 內容，編號調整為 §6）
- **日期區間**: 支援起訖日期篩選，初始預設顯示「當月」。
- **商品類別**: 下拉選單可過濾特定商品。

### B. 設計畫面
1. **圓餅圖 (Pie Chart)**: 統計各商品訂購數量的佔比（以按下複製按鈕之數據為準）。
2. **趨勢曲線圖 (Line Chart)**:
    - **橫軸**: 日期。
    - **縱軸**: 同時繪製「訂購累計總數」與「累計總金額」兩條曲線