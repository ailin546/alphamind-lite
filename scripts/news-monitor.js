#!/usr/bin/env node
/**
 * AlphaMind Lite - News Monitor
 * 获取币安最新公告
 */

const https = require('https');

// Binance news API
const NEWS_API = 'www.binance.com';
const NEWS_PATH = '/bapi/cms/v1/front/cms/news/list?pageNo=1&pageSize=5';

function fetchNews() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: NEWS_API,
      path: NEWS_PATH,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📡 Fetching Binance news...\n');
  
  try {
    const result = await fetchNews();
    
    if (result.data && result.data.length > 0) {
      console.log('Latest 5 Binance announcements:\n');
      result.data.slice(0, 5).forEach((item, i) => {
        console.log(`${i + 1}. ${item.title || 'Untitled'}`);
        console.log(`   📅 ${item.publishDate || 'Unknown date'}`);
        console.log(`   🔗 ${item.url || 'No link'}`);
        console.log('');
      });
    } else {
      console.log('No news found or API rate limited.');
      console.log('Fallback: Using mock data for demo...\n');
      console.log('📰 Demo News (Mock):');
      console.log('1. 🔔 Binance Will List Protocol Token (NEW)');
      console.log('   📅 2026-03-05');
      console.log('2. 📢 Important: System Maintenance Notice');
      console.log('   📅 2026-03-04');
      console.log('3. 🎉 New Feature: AI Agent Integration');
      console.log('   📅 2026-03-03');
    }
  } catch (error) {
    console.log('❌ Error fetching news:', error.message);
    console.log('\n📰 Demo Mode (fallback):');
    console.log('1. 🔔 Binance Will List Protocol Token (NEW)');
    console.log('2. 📢 Important: System Maintenance Notice');
    console.log('3. 🎉 New Feature: AI Agent Integration');
  }
}

main();
