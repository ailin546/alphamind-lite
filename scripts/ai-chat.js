/**
 * AlphaMind Lite - AI Chat 集成脚本
 * 
 * 使用 OpenClaw Gateway 作为 AI 对话引擎
 * 将用户消息发送到 agent:main:main 并返回 AI 回复
 * 
 * 用法:
 *   node ai-chat.js "BTC 行情怎么样"
 *   node ai-chat.js "ETH 现在可以买入吗"
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  gatewayPort: 18789,
  agentId: 'main:main',
  timeout: 60, // 秒
};

/**
 * 发送消息到 OpenClaw Agent 并获取回复
 * @param {string} message - 用户消息
 * @returns {Promise<string>} - AI 回复
 */
async function chat(message) {
  return new Promise((resolve, reject) => {
    const cmd = `openclaw agent --agent ${CONFIG.agentId} -m "${message.replace(/"/g, '\\"')}" --json --timeout ${CONFIG.timeout}`;
    
    console.log(`🤖 发送消息: ${message}`);
    console.log(`📡 调用命令: ${cmd}`);
    
    exec(cmd, { 
      encoding: 'utf8',
      timeout: CONFIG.timeout * 1000,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ 执行错误:', error.message);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.log('⚠️ stderr:', stderr);
      }
      
      if (stdout) {
        try {
          // 尝试解析 JSON 输出
          const result = JSON.parse(stdout);
          const reply = result.reply || result.message || result.content || result.text || JSON.stringify(result);
          resolve(reply);
        } catch (e) {
          // 如果不是 JSON，直接返回原始输出
          resolve(stdout.trim());
        }
      } else {
        reject(new Error('No response from agent'));
      }
    });
  });
}

/**
 * 交互式聊天模式
 */
async function interactive() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n🤖 AlphaMind Lite AI 对话模式');
  console.log('='.repeat(40));
  console.log('输入您的问题，按 Enter 发送');
  console.log('输入 "quit" 或 "exit" 退出\n');
  
  const askQuestion = () => {
    rl.question('👤 你: ', async (input) => {
      const message = input.trim();
      
      if (message.toLowerCase() === 'quit' || message.toLowerCase() === 'exit') {
        console.log('👋 再见!');
        rl.close();
        return;
      }
      
      if (!message) {
        askQuestion();
        return;
      }
      
      try {
        console.log('\n⏳ AI 正在思考...\n');
        const reply = await chat(message);
        console.log('🤖 AlphaMind:', reply);
        console.log('');
      } catch (error) {
        console.log('❌ 错误:', error.message);
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 无参数时进入交互模式
    await interactive();
  } else {
    // 有参数时执行单次对话
    const message = args.join(' ');
    try {
      console.log('🤖 AlphaMind Lite AI 对话\n');
      const reply = await chat(message);
      console.log('='.repeat(40));
      console.log('🤖 AI 回复:');
      console.log(reply);
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  }
}

// 导出模块
module.exports = { chat };

// 运行主函数
main().catch(console.error);
