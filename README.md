# 🌻 老園丁窯烤麵包

全素．無蛋奶．無油．窯烤麥香 — 小型電商訂購系統

---

## 專案簡介

「老園丁窯烤麵包」的線上訂購與管理平台，包含：

- **顧客前台** (`index.html`)：瀏覽商品、加入購物車、複製訂單至 Line
- **管理後台** (`admin.html`)：商品 CRUD、圖片上傳、訂單統計圖表
- **RESTful API** (`api/index.js`)：Node.js + Express，部署於 Vercel Serverless

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript |
| 後端 | Node.js + Express.js |
| 部署 | Vercel Serverless Functions |
| 資料儲存 | Vercel Blob（商品資料 `products.json` + 圖片） |
| 統計日誌 | Vercel KV（Redis，訂單記錄） |
| 驗證 | HMAC Token（72 小時效期，存於 localStorage） |
| 統計圖表 | Chart.js |

---

## 專案結構

```
OldGarden/
├── api/
│   └── index.js          # Express 主程式（Vercel Serverless Function）
├── .vscode/
│   └── launch.json       # VSCode debug 設定
├── index.html            # 顧客訂購前台
├── admin.html            # 管理員後台
├── login.html            # 管理員登入頁
├── server.js             # 本地 Node.js 開發入口
├── run.bat               # 一鍵啟動腳本（Windows）
├── package.json
├── vercel.json
├── .env.example          # 環境變數範例
└── .gitignore
```

---

## API 端點

### 公開

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/login` | 管理員登入，回傳 Token |
| `GET` | `/api/products` | 取得所有商品（空時自動 Seed） |
| `POST` | `/api/stats/track` | 記錄訂單統計（複製按鈕觸發） |

### 需要管理員 Token

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/products` | 新增商品 |
| `PUT` | `/api/products/:id` | 更新商品欄位 |
| `DELETE` | `/api/products/:id` | 刪除商品（含 Blob 圖片） |
| `POST` | `/api/upload` | 上傳圖片至 Vercel Blob（max 5MB） |
| `GET` | `/api/stats` | 取得統計報表（支援日期區間篩選） |

---

## 商品資料欄位

```json
{
  "id": 1,
  "name": "綜合堅果",
  "weight": "320g",
  "price": 100,
  "url": "https://外部圖片備用網址",
  "imagePath": "https://blob.vercel-storage.com/...",
  "desc": "商品描述"
}
```

**圖片顯示優先順序**：`imagePath`（Blob）→ `url`（外部連結）→ 商品名稱文字

---

## 環境設定

複製 `.env.example` 為 `.env.local`，填入以下變數：

```env
# 管理員帳密
ADMIN_USER=admin
ADMIN_PASS=your_password_here

# Vercel KV（從 Vercel Dashboard > Storage > KV 取得）
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Vercel Blob（從 Vercel Dashboard > Storage > Blob 取得）
BLOB_READ_WRITE_TOKEN=
```

---

## 本地開發

### 快速啟動（Windows）

```bash
# 雙擊執行，依選單選擇啟動模式
run.bat
```

### 手動啟動

```bash
npm install

# 模式一：Vercel Dev（完整模擬 KV / Blob，推薦）
npm run dev

# 模式二：直接 Node.js（快速，需設定 .env.local）
npm run debug
```

### VSCode Debug

按 `F5`，選擇以下任一設定：

- **Debug API (Node.js)** — 直接執行 Express，支援熱重啟
- **Debug API (Node.js + 中斷點)** — 可設中斷點逐行追蹤
- **Vercel Dev** — 在整合終端機啟動 vercel dev

---

## 部署至 Vercel

1. 將專案推送至 GitHub
2. 在 [Vercel Dashboard](https://vercel.com/) 匯入專案
3. 至 **Storage** 建立 KV 與 Blob 服務並連結專案
4. 至 **Settings > Environment Variables** 填入 `ADMIN_USER`、`ADMIN_PASS`
5. 部署完成，KV / Blob 變數會自動注入

---

## 授權

© 老園丁窯烤麵包 保留所有權利
