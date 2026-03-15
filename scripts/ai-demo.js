#!/usr/bin/env node
/**
 * AlphaMind Lite - AI Demo with OpenClaw Integration
 * 使用 OpenClaw 作为 AI 对话引擎
 */

const http = require('http');

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY || '127.0.0.1:18789';
const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || '';

async function sendMessage(message, sessionKey = 'agent:main:main') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      sessionKey,
      message,
      deliver: false
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 18789,
      path: '/v1/sessions/' + encodeURIComponent(sessionKey) + '/turns',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AUTH_TOKEN
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🤖 AlphaMind Lite - AI 对话演示');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('💬 用户: "BTC 还能买吗？"');
  console.log('');
  console.log('⏳ AI 思考中...\n');

  try {
    const response = await sendMessage('用简洁的中文回答：BTC 现在适合买入吗？给出理由。');
    const result = JSON.parse(response);
    console.log('🤖 AlphaMind:');
    console.log(result.response || result.message || '（AI 回复）');
  } catch (e) {
    console.log('📝 Demo 回复:');
    console.log('基于当前分析，BTC 短期走势强劲，但需注意风险控制。');
    console.log('建议：');
    console.log('1. 恐慌指数 22（极度恐慌），历史上可能是买入机会');
    console.log('2. 可考虑分批建仓，不要梭哈');
    console.log('3. 设置止损线，建议 5-10%');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
}

main();
