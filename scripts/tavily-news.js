#!/usr/bin/env node

/**
 * Binance News Search via Tavily
 * 搜索 Binance 最新公告新闻，返回中文结果
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const API_URL = "https://api.tavily.com/search";

if (!TAVILY_API_KEY) {
  console.error("❌ 缺少 TAVILY_API_KEY 环境变量");
  process.exit(1);
}

const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0], 10) : 5; // 默认5条

async function searchBinanceNews(maxResults = 5) {
  const body = {
    api_key: TAVILY_API_KEY,
    query: "Binance announcement news",
    search_depth: "basic",
    topic: "news",
    max_results: Math.max(1, Math.min(maxResults, 20)),
    include_answer: true,
    include_raw_content: false,
    days: 3, // 最近3天
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
  
  // 打印 AI 生成的摘要（英文，我们翻译成中文）
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

// 运行
searchBinanceNews(count)
  .then(() => console.log("✅ 搜索完成"))
  .catch((err) => {
    console.error("❌ 搜索失败:", err.message);
    process.exit(1);
  });
