const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { put, del } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(express.json());

// 延遲初始化，相容 Vercel 兩種 Upstash 環境變數命名
let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      '找不到 Redis 環境變數，請確認 Vercel 已設定以下其中一組：\n' +
      '  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN\n' +
      '  KV_REST_API_URL + KV_REST_API_TOKEN'
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

const PRODUCTS_KEY = 'bakery_products';
const LOGS_KEY = 'order_logs';
const TOKEN_EXPIRY = 72 * 60 * 60 * 1000; // 72 小時

const SEED_DATA = [
  { id: 1, name: '綜合堅果', weight: '320g', price: 100, url: '', imagePath: '', desc: '蔓越莓、葡萄乾、黑芝麻、南瓜子、核桃、腰果' },
  { id: 2, name: '原味香草', weight: '450g', price: 100, url: '', imagePath: '', desc: '多種義式香料完美比例，鹹香順口，可夾蘋果片或起司' },
  { id: 3, name: '桔香果乾', weight: '320g', price: 100, url: '', imagePath: '', desc: '蔓越莓、葡萄乾、南瓜子與桔丁皮，水果香氣豐富' },
  { id: 4, name: '全麥核桃', weight: '380g', price: 150, url: '', imagePath: '', desc: '彰化在地無農藥全麥粉，凸顯麥香' },
  { id: 5, name: '桂圓核桃', weight: '360g', price: 200, url: '', imagePath: '', desc: '自釀水果酵素，麵包體柔軟，桂圓香氣濃郁' },
];

// ── Token 工具 ──────────────────────────────────────────────
function getSecret() {
  return process.env.ADMIN_PASS || 'dev_secret';
}

function generateToken(user) {
  const exp = Date.now() + TOKEN_EXPIRY;
  const payload = Buffer.from(JSON.stringify({ user, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

// ── 管理員驗證 Middleware ────────────────────────────────────
function adminAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Redis 讀寫 products ──────────────────────────────────────
async function readProducts() {
  try {
    return await getRedis().get(PRODUCTS_KEY);
  } catch { return null; }
}

async function writeProducts(products) {
  await getRedis().set(PRODUCTS_KEY, products);
}

// ── Redis 讀寫 logs ──────────────────────────────────────────
async function readLogs() {
  try {
    return (await getRedis().get(LOGS_KEY)) || [];
  } catch { return []; }
}

async function writeLogs(logs) {
  await getRedis().set(LOGS_KEY, logs);
}

// ── POST /api/login ──────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return res.json({ token: generateToken(user) });
  }
  res.status(401).json({ error: '帳號或密碼錯誤' });
});

// ── GET /api/products ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    let products = await readProducts();
    if (!products) {
      products = SEED_DATA;
      await writeProducts(products);
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products ───────────────────────────────────────
app.post('/api/products', adminAuth, async (req, res) => {
  try {
    const { name, weight, price, desc, url, imagePath } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name 與 price 為必填' });
    }
    const products = (await readProducts()) || [...SEED_DATA];
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const product = {
      id: newId,
      name,
      weight: weight || '',
      price: Number(price),
      url: url || '',
      imagePath: imagePath || '',
      desc: desc || '',
    };
    products.push(product);
    await writeProducts(products);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/products/:id ────────────────────────────────────
app.put('/api/products/:id', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const products = (await readProducts()) || [];
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: '找不到產品' });
    products[idx] = { ...products[idx], ...req.body, id };
    await writeProducts(products);
    res.json(products[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/products/:id ─────────────────────────────────
app.delete('/api/products/:id', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const products = (await readProducts()) || [];
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: '找不到產品' });
    const [removed] = products.splice(idx, 1);
    await writeProducts(products);

    // 刪除 Blob 圖片（非阻斷，失敗只回傳警告）
    let imageDeleted = false;
    if (removed.imagePath) {
      try {
        await del(removed.imagePath);
        imageDeleted = true;
      } catch (e) {
        console.error('[Blob] 圖片刪除失敗:', e.message);
      }
    }

    res.json({ success: true, deleted: removed, imageDeleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/upload ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只接受圖片檔案'));
  },
});

app.post('/api/upload', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未收到圖片' });
    const filename = `images/${Date.now()}-${req.file.originalname}`;
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    res.json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/images/:key（代理 redirect）────────────────────
app.get('/api/images/:key', (req, res) => {
  res.redirect(301, `https://blob.vercel-storage.com/${req.params.key}`);
});

// ── POST /api/stats/track ────────────────────────────────────
app.post('/api/stats/track', async (req, res) => {
  try {
    const { items, total } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items 必須為陣列' });
    const date = new Date().toISOString().slice(0, 10);
    const entry = { date, items, total: total || 0, timestamp: Date.now() };
    const logs = await readLogs();
    logs.push(entry);
    await writeLogs(logs);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stats ───────────────────────────────────────────
app.get('/api/stats', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, product } = req.query;
    let logs = await readLogs();
    if (startDate) logs = logs.filter(l => l.date >= startDate);
    if (endDate) logs = logs.filter(l => l.date <= endDate);
    if (product) {
      logs = logs
        .map(l => ({ ...l, items: l.items.filter(i => i.name === product) }))
        .filter(l => l.items.length > 0);
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
