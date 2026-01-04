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
    const usedTokenClasses = new Set<string>();
    
    // 递归获取所有相关元素 (Original)
    const allElements = [element, ...Array.from(element.querySelectorAll('*'))];
    
    // Special handling: which elements are "safe" (all classes used) due to attribute selectors
    const elementsWithAttributeMatch = new Set<Element>();

    const classTokenRegex = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;

    for (const cssText of cssContents) {
      if (!cssText) continue;
      try {
        const ast = parse(cssText);
        walk(ast, {
          visit: 'Rule',
          enter: (node: CssNode) => {
             const rule = node as Rule;
             if (rule.prelude.type === 'SelectorList') {
                 const selectorStr = generate(rule.prelude);
                 const selectors = selectorStr.split(','); 
                 
                 for (let sel of selectors) {
                     sel = sel.trim();
                     try {
                         // Check match efficiently
                         // We iterate inputs to find specific matches
                         // Optimization: Using querySelectorAll from root if possible, 
                         // but here we have a constrained list 'allElements'.
                         // 'matches' on all elements is O(N*M), slow but acceptable for small snippets.
                         
                         // To identify which elements matched this specific selector:
                         const matchedEls = allElements.filter(el => el.matches(sel));
                         
                         if (matchedEls.length > 0) {
                            matchedRules.add(`${generate(rule.prelude)} { ${generate(rule.block)} }`);
                            
                            // Analysis for Unused Classes
                            // 1. Extract explicit class tokens from selector
                            let match;
                            classTokenRegex.lastIndex = 0;
                            while ((match = classTokenRegex.exec(sel)) !== null) {
                                usedTokenClasses.add(match[1]);
                            }

                            // 2. Check for attribute selectors on class
                            if (sel.includes('[class')) {
                                matchedEls.forEach(el => elementsWithAttributeMatch.add(el));
                            }
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

    // 5. 生成结果 (HTML Cleaning)
    const clone = element.cloneNode(true) as HTMLElement;
    const allClonedElements = [clone, ...Array.from(clone.querySelectorAll('*'))];

    // Map original elements to cloned elements by index (assuming structure is identical)
    // This relies on querySelectorAll returning traversal order being consistent.
    // Since we just cloned, order is preserved.
    
    allClonedElements.forEach((el, index) => {
        const originalEl = allElements[index];
        if (!originalEl) return; // Should not happen

        if (el instanceof HTMLElement) {
            const classes = Array.from(el.classList);
            if (classes.length > 0) {
                const uniqueClasses = new Set(classes); // Deduplicate
                const finalClasses: string[] = [];

                // Logic:
                // If this element was matched by an attribute selector (e.g. [class^="test"]), 
                // we treat ALL its classes as "used" to be safe.
                // Otherwise, we only keep classes that appeared explicitly in some matched selector.
                const preserveAll = elementsWithAttributeMatch.has(originalEl);

                uniqueClasses.forEach(cls => {
                    if (preserveAll || usedTokenClasses.has(cls)) {
                        finalClasses.push(cls);
                    }
                });

                if (finalClasses.length > 0) {
                    el.className = finalClasses.join(' ');
                } else {
                    el.removeAttribute('class');
                }
            }
        }
    });

    const cssResult = Array.from(matchedRules).join('\n');
    const htmlResult = clone.outerHTML;

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
