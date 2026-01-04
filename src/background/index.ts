console.log('StyleSniffer Background Service Worker Loaded');

import { onMessage, sendMessage } from 'webext-bridge/background'
import { fetchCssContent } from './fetcher'

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    // 使用原生 API 广播消息，确保所有 Frame (包括 iframe) 都能收到
    // webext-bridge 的 sendMessage 默认可能只发给 Top Frame
    try {
        await chrome.tabs.sendMessage(tab.id, { type: 'style-sniffer-toggle' });
    } catch (e) {
        console.warn('Failed to send toggle request (maybe content script not ready):', e);
    }
  }
});

// 监听获取 CSS 的请求
onMessage('fetch-css', async ({ data }) => {
  const { url } = data as { url: string };
  console.log('Fetching CSS for:', url);
  const css = await fetchCssContent(url);
  return { css };
});

onMessage('demo-message', ({ data }) => {
  console.log('Received message from content:', data)
  return { response: 'Hello from background' }
})
