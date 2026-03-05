#!/usr/bin/env node

/**
 * Binance News Search via Tavily
 * 搜索 Binance 最新公告新闻，返回中文结果
 * 
 * 使用方法:
 *   node tavily-news.js [结果数量]
 * 
 * 环境变量:
 *   TAVILY_API_KEY - 从 https://tavily.com 获取 API 密钥
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const API_URL = "https://api.tavily.com/search";

async function searchBinanceNews(maxResults = 5) {
  if (!TAVILY_API_KEY) {
    console.log("❌ 请先配置 TAVILY_API_KEY");
    console.log("");
    console.log("获取 API Key:");
    console.log("1. 访问 https://tavily.com 注册账号");
    console.log("2. 获取 API Key");
    console.log("3. 运行: export TAVILY_API_KEY=你的key");
    console.log("");
    console.log("或者在 ~/.openclaw/workspace/.env 中添加:");
    console.log("TAVILY_API_KEY=你的key");
    return [];
  }

  const body = {
    api_key: TAVILY_API_KEY,
    query: "Binance announcement news",
    search_depth: "basic",
    topic: "news",
    max_results: Math.max(1, Math.min(maxResults, 20)),
    include_answer: true,
    include_raw_content: false,
    days: 3,
  };

  console.log(`🔍 正在搜索 Binance 最新公告...\n`);

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Tavily API 错误 (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  
  // 打印 AI 生成的摘要
  if (data.answer) {
    console.log("📰 Binance 动态摘要:");
    console.log("---");
    console.log(data.answer);
    console.log("---\n");
  }

  // 打印结果
  const results = (data.results ?? []).slice(0, maxResults);
  console.log(`📄 最新公告 (${results.length} 条):\n`);

  for (const r of results) {
    const title = String(r?.title ?? "").trim();
    const url = String(r?.url ?? "").trim();
    const content = String(r?.content ?? "").trim();
    const score = r?.score ? ` (相关性: ${(r.score * 100).toFixed(0)}%)` : "";
    
    if (!title || !url) continue;
    console.log(`🔹 ${title}${score}`);
    console.log(`   🔗 ${url}`);
    if (content) {
      console.log(`   📝 ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`);
    }
    console.log();
  }

  return results;
}

// 主入口
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0], 10) : 5;

searchBinanceNews(count)
  .then((results) => {
    if (results.length > 0) {
      console.log("✅ 搜索完成");
    }
  })
  .catch((err) => {
    console.error("❌ 搜索失败:", err.message);
    process.exit(1);
  });
