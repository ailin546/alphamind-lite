# AlphaMind Lite 更新日志

## v10.0.0 (2026-03-14)
### 重大更新 — 生产级安全与性能优化
- **安全加固**：添加 CSP 安全头、XSS 防护、输入验证、敏感路径屏蔽
- **性能优化**：API 响应缓存（5-30s TTL）、SSE 心跳保活、速率限制器防 DoS
- **新增 API**：K线数据、市场情绪分析、相关性矩阵、风险计算、DCA计算、AI对话
- **前端修复**：API 错误处理、XSS 防护、聊天防抖、HTML 语言标签修正
- **DevOps**：Dockerfile 错误处理修复、Docker Compose 安全端口配置、PM2 实例数优化
- **文档对齐**：产品规格重写匹配实际 Node.js 实现

## v9.2.0 (2026-03-12)
### 生产部署就绪
- Docker + Nginx + PM2 完整部署方案
- GitHub Actions CI/CD 流水线
- 36 项自动化测试
- Prometheus metrics 端点

## v9.0.0 (2026-03-10)
### Web Dashboard 全面升级
- 全新暗色主题仪表盘 (dashboard.html)
- 实时市场数据表格 (12+ 币种)
- 投资组合管理与分析
- SSE 实时价格推送

## v8.0.0 (2026-03-08)
### 高级分析工具
- 永续合约资金费率套利 (`funding-arbitrage.js`)
- 市场相关性矩阵 (`market-correlation.js`)
- 鲸鱼交易追踪 (`whale-alert.js`)
- 恐慌贪婪指数集成 (`fear-greed.js`)

## v5.0.0 (2026-03-06)
### CLI 工具集完善
- 19 个 CLI 工具全部就绪
- JSON 文件持久化层 (`db.js`)
- 结构化日志系统 (`logger.js`)
- Telegram 通知集成 (`notify.js`)

## v2.0.0 (2026-03-05)
### 核心功能版本
- 实时行情查询
- 仓位风险计算
- 价格监控告警
- AI 对话助手

## v1.0.0 (2026-03-05)
### 初始版本
- 基础行情查询
- 项目架构搭建
- Demo 演示脚本

---

## 贡献者

- **ailin546** — 首席开发者
