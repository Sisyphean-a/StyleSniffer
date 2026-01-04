/**
 * 负责跨域获取 CSS 内容
 * 运行在 Background Service Worker 环境
 */

const cache = new Map<string, string>();

export async function fetchCssContent(url: string): Promise<string> {
  if (cache.has(url)) {
    return cache.get(url)!;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSS: ${response.statusText}`);
    }
    const text = await response.text();
    cache.set(url, text);
    return text;
  } catch (error) {
    console.error(`Error fetching CSS from ${url}:`, error);
    return ''; // Return empty string on failure to avoid breaking the flow
  }
}

export function clearCache() {
  cache.clear();
}
