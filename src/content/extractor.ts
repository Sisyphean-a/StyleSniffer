import { sendMessage } from 'webext-bridge/content-script';
import { parse, walk, generate, type CssNode, type Rule } from 'css-tree';

export class Extractor {
  /**
   * 启动提取流程
   * @param element 选中的根元素
   */
  public async extract(element: HTMLElement): Promise<string> {
    console.log('Starting extraction for:', element);

    // 1. 收集页面所有样式资源
    const styleResources = this.collectStyleResources();
    console.log('Found resources:', styleResources);

    // 2. 获取所有 CSS 内容 (并发)
    const cssContents = await Promise.all(
        styleResources.map(url => this.fetchCss(url))
    );

    // 3. 收集内联样式
    const inlineStyles = this.collectInlineStyles();
    cssContents.push(...inlineStyles);

    console.log(`Loaded ${cssContents.length} style chunks. Parsing...`);

    // 4. 解析并匹配
    const matchedRules = new Set<string>();
    
    // 递归获取所有相关元素
    const allElements = [element, ...Array.from(element.querySelectorAll('*'))];

    for (const cssText of cssContents) {
      if (!cssText) continue;
      try {
        const ast = parse(cssText);
        walk(ast, {
          visit: 'Rule',
          enter: (node: CssNode) => {
             const rule = node as Rule;
             if (rule.prelude.type === 'SelectorList') {
                 // 简单处理：生成选择器字符串，尝试匹配
                 // 注意：css-tree 的 generate 可能比较慢，需优化
                 // 这里需要更精细的 AST 处理，暂时粗暴实现
                 const selectorStr = generate(rule.prelude);
                 
                 // 拆分逗号分隔的选择器
                 const selectors = selectorStr.split(','); 
                 
                 for (let sel of selectors) {
                     sel = sel.trim();
                     // Remove pseudo-classes that might break matches() (like :hover for now, or keep them?)
                     // matches() actually supports many pseudo-classes.
                     try {
                         // 检查是否匹配我们选区内的任何元素
                         // 性能警告：O(N*M)
                         const isMatch = allElements.some(el => el.matches(sel));
                         if (isMatch) {
                            matchedRules.add(`${generate(rule.prelude)} { ${generate(rule.block)} }`);
                            break; // 只要有一个部分匹配，就保留整条规则 (或者只保留匹配的那部分?) -> 保留整条比较安全
                         }
                     } catch (e) {
                         // Ignore invalid selectors
                     }
                 }
             }
          }
        });
      } catch (e) {
        console.warn('Failed to parse a CSS chunk', e);
      }
    }

    // 5. 生成结果
    const cssResult = Array.from(matchedRules).join('\n');
    const htmlResult = element.outerHTML;

    return `<style>\n${cssResult}\n</style>\n\n${htmlResult}`;
    
  }

  private collectStyleResources(): string[] {
    const urls: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = (link as HTMLLinkElement).href;
        if (href) urls.push(href);
    });
    return urls;
  }

  private collectInlineStyles(): string[] {
      const styles: string[] = [];
      document.querySelectorAll('style').forEach(style => {
          styles.push(style.innerHTML);
      });
      return styles;
  }

  private async fetchCss(url: string): Promise<string> {
      try {
        // 请求后台获取
        const reponse = await sendMessage('fetch-css', { url }, 'background');
        return (reponse as { css: string }).css;
      } catch (e) {
          console.error('Failed to fetch via background:', url, e);
          return '';
      }
  }
}

export const extractor = new Extractor();
