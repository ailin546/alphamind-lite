#!/usr/bin/env node
/**
 * AlphaMind Lite - Fear & Greed Index
 * 恐慌指数获取
 */

const https = require('https');

function fetchWithTimeout(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

async function getFearGreed() {
  try {
    const data = await fetchWithTimeout('https://api.alternative.me/fng/');
    const json = JSON.parse(data);
    // Validate response
    if (!json.data || !json.data[0] || !json.data[0].value) {
      throw new Error('Invalid API response');
    }
    return json.data[0];
  } catch (e) {
    return null;
  }
}

function getSentiment(value) {
  if (value <= 25) return '😱 极度恐慌';
  if (value <= 45) return '😰 恐慌';
  if (value <= 55) return '😐 中性';
  if (value <= 75) return '😊 贪婪';
  return '🤑 极度贪婪';
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   📊 加密市场恐慌指数');
  console.log('═══════════════════════════════════════════════════\n');
  
  const item = await getFearGreed();
  
  if (!item) {
    console.log('❌ 获取失败，请检查网络');
    return;
  }
  
  const value = parseInt(item.value);
  if (isNaN(value)) {
    console.log('❌ 数据无效');
    return;
  }
  
  const sentiment = getSentiment(value);
  const updateTime = new Date(item.timestamp * 1000).toLocaleString('zh-CN');
  
  console.log(`🎯 当前指数: ${value}/100`);
  console.log(`📈 市场情绪: ${sentiment}`);
  console.log(`🕐 更新时间: ${updateTime}`);
  console.log('');
  
  if (value < 25) {
    console.log('💡 AI 建议: 极度恐慌可能是买入机会，分批建仓');
  } else if (value < 45) {
    console.log('💡 AI 建议: 恐慌情绪，可以适当布局');
  } else if (value < 55) {
    console.log('💡 AI 建议: 市场中性，观望为主');
  } else if (value < 75) {
    console.log('💡 AI 建议: 市场贪婪，注意风险');
  } else {
    console.log('💡 AI 建议: 极度贪婪，考虑部分止盈');
  }
  
  console.log('\n═══════════════════════════════════════════════════');
}

main();
