console.log('StyleSniffer Background Service Worker Loaded');

import { onMessage } from 'webext-bridge/background'
import { fetchCssContent } from './fetcher'

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
