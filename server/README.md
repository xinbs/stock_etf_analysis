# Stock Analysis Server

本目录是独立本地服务版本，和 `../etf-sector-extension` Chrome 插件目录分开。

## 本地运行

```bash
cd /Users/xinquan.liang/tmp_code/stock_analysis/server
npm start
```

需要 Node.js 24 或以上版本。服务使用 Node 内置 SQLite 模块长期保存 ETF 资金流。

访问：

```text
http://127.0.0.1:8787
```

## Docker

从项目根目录或 `server/` 目录都可以：

```bash
cd /Users/xinquan.liang/tmp_code/stock_analysis/server
docker compose up -d --build
```

局域网访问：

```text
http://<部署机器IP>:8787
```

## 部署到 192.168.31.218

需要本机能 SSH 到目标机器，且目标机器已安装 Docker / Docker Compose。

```bash
cd /Users/xinquan.liang/tmp_code/stock_analysis/server
chmod +x deploy.sh
./deploy.sh 192.168.31.218 ~/stock_analysis
```

启动后访问：

```text
http://192.168.31.218:8787
```

数据文件默认持久化到：

```text
server/data/db.json
server/data/fund_flows.sqlite
```

Docker 部署时该目录挂载到容器 `/data`，重新 build / up 不会删除历史数据。`deploy.sh` 也会跳过 `server/data`。

## 数据更新策略

- 历史 ETF K 线保存在本地 `server/data/db.json`，分析页优先读取本地 DB。
- ETF 资金流保存在本地 `server/data/fund_flows.sqlite`，默认按 ETF 自身资金流汇总为板块资金流。
- 服务启动 5 秒后会自动增量更新最近 45 天 ETF / A 股指数 K 线，并刷新实时缓存。
- ETF 资金流历史全量补齐只在手动触发时执行，避免频繁访问东财。
- 服务运行期间每 6 小时自动做一次同样的增量更新。
- 服务运行期间每 30 分钟刷新一次 ETF 实时/日内资金流。
- 服务启动和运行期间每 6 小时只增量补最近 8 个交易日 ETF 资金流。
- 手动触发：

```bash
curl -X POST http://127.0.0.1:8787/api/message \
  -H 'Content-Type: application/json' \
  -d '{"action":"updateDailyHistory"}'

curl -X POST http://127.0.0.1:8787/api/message \
  -H 'Content-Type: application/json' \
  -d '{"action":"updateEtfFundFlows"}'

curl -X POST http://127.0.0.1:8787/api/message \
  -H 'Content-Type: application/json' \
  -d '{"action":"backfillEtfFundFlows","limit":260}'
```
