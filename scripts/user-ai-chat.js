#!/usr/bin/env node
/**
 * AlphaMind Lite - User AI Chat
 * 用户可自行配置 API Key 的 AI 对话功能
 * 不使用本系统 API，保护用户隐私
 */

const https = require('https');

// 用户配置 - 在这里填入你自己的 API Key
const CONFIG = {
  // 选项 1: OpenAI API
  // openai: { apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com/v1' },
  
  // 选项 2: Kimi API (月之暗面)
  // kimi: { apiKey: 'sk-xxx', baseUrl: 'https://api.moonshot.cn/v1' },
  
  // 选项 3: MiniMax API
  // minimax: { apiKey: 'sk-xxx', baseUrl: 'https://api.minimaxi.com/v1' },
  
  // 当前使用: 不启用（保护隐私）
};

// 示例: 如何启用用户自己的 API
function getExampleConfig() {
  return `
# 使用你自己的 API Key

编辑 scripts/user-ai-chat.js，填入你的 API:

## 选项 1: OpenAI
const CONFIG = {
  openai: { apiKey: 'sk-your-key', model: 'gpt-4o' }
};

## 选项 2: Kimi (推荐国内用户)
const CONFIG = {
  kimi: { apiKey: 'sk-your-key', model: 'kimi-k2p5' }
};

## 选项 3: MiniMax
const CONFIG = {
  minimax: { apiKey: 'sk-your-key', model: 'MiniMax-M2.5' }
};
`;
}

async function chatWithAI(message, config = {}) {
  // 如果没有配置，返回提示
  if (!config.apiKey) {
    return { error: '请配置你自己的 API Key', guide: getExampleConfig() };
  }
  
  const { apiKey, baseUrl, model } = config;
  
  const body = JSON.stringify({
    model: model || 'gpt-4o',
    messages: [{ role: 'user', content: message }],
    max_tokens: 500
  });

  return new Promise((resolve) => {
    const url = new URL(baseUrl + '/chat/completions');
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ response: json.choices?.[0]?.message?.content });
        } catch (e) {
          resolve({ error: 'API 调用失败' });
        }
      });
    });
    req.on('error', () => resolve({ error: '网络错误' }));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💬 AlphaMind Lite - AI 对话');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📝 当前状态: 未配置 API Key（保护隐私）');
  console.log('');
  console.log('💡 使用说明:');
  console.log('  编辑 scripts/user-ai-chat.js');
  console.log('  填入你自己的 API Key');
  console.log('  支持 OpenAI / Kimi / MiniMax');
  console.log('');
  console.log('🔒 隐私说明:');
  console.log('  • 不使用本系统 API');
  console.log('  • 你的 API Key 仅保存在本地');
  console.log('  • 不会上传到任何服务器');
  console.log('');
  console.log(getExampleConfig());
  console.log('═══════════════════════════════════════════════════════════');
}

main();
