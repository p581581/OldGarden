// 本地開發用伺服器（直接以 Node.js 執行，非 Vercel Serverless）
// 會自動載入 .env.local 的環境變數
require('dotenv').config({ path: '.env.local' });

const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[老園丁] API 伺服器啟動：http://localhost:${PORT}`);
  console.log(`[老園丁] 前台：http://localhost:${PORT}/`);
  console.log(`[老園丁] 管理後台：http://localhost:${PORT}/admin.html`);
  console.log('按下 Ctrl+C 停止伺服器');
});
