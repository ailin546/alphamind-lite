#!/usr/bin/env node
/**
 * AlphaMind Lite - Fear & Greed Index
 * 恐慌指数获取
 * 
 * 数据源 alternatives:
 * 1. alternative.me crypto fear & greed index
 * 2. CoinGlass (需要API key)
 */

const https = require('https');

// alternative.me Fear & Greed Index API
const FGI_API = 'api.alternative.me';

function fetchFearGreed() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: FGI_API,
      path: '/fng/',
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function getSentiment(value) {
  if (value <= 25) return '😱 极度恐慌';
  if (value <= 45) return '😰 恐慌';
  if (value <= 55) return '😐 中性';
  if (value <= 75) return '😊 贪婪';
  return '🤑 极度贪婪';
}

async function main() {
  console.log('📊 加密市场恐慌指数');
  console.log('═══════════════════════════\n');
  
  try {
    const result = await fetchFearGreed();
    
    if (result.data && result.data[0]) {
      const item = result.data[0];
      const value = parseInt(item.value);
      const sentiment = getSentiment(value);
      const updateTime = new Date(item.timestamp * 1000).toLocaleString('zh-CN');
      
      console.log(`🎯 当前指数: ${value}/100`);
      console.log(`📈 市场情绪: ${sentiment}`);
      console.log(`🕐 更新时间: ${updateTime}`);
      console.log('');
      
      // AI 建议
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
    }
  } catch (e) {
    console.log('❌ 获取失败:', e.message);
    console.log('\n📝 Demo 数据:');
    console.log('🎯 当前指数: 65/75');
    console.log('📈 市场情绪: 😊 贪婪');
    console.log('💡 AI 建议: 注意风险，可考虑部分止盈');
  }
}

main();
