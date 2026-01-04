import { sendMessage } from 'webext-bridge/content-script';
import { parse, walk, generate, type CssNode, type Rule, type Declaration } from 'css-tree';

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
    // Map<Selector, Declaration[]> to deduplicate at property level
    const ruleMap = new Map<string, Declaration[]>();
    
    // 递归获取所有相关元素 (Original)
    const allElements = [element, ...Array.from(element.querySelectorAll('*'))];
    
    // Special handling: which elements are "safe" (all classes used) due to attribute selectors
    const elementsWithAttributeMatch = new Set<Element>();
    const usedTokenClasses = new Set<string>();

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
                     if (!sel) continue;

                     try {
                         // Strict Match Check
                         const matchedEls = allElements.filter(el => el.matches(sel));
                         
                         if (matchedEls.length > 0) {
                            // CLEANUP: Remove data-v garbage
                            const cleanSel = sel.replace(/\[data-v-[a-zA-Z0-9]+(?:='[^']*'|="[^"]*")?\]/g, '').trim();
                            if (!cleanSel) continue;

                            // Extract Declarations
                            const declarations: Declaration[] = [];
                            // Using walk on the block key seems safer or just iterating children if specific type
                            if (rule.block.children) {
                                rule.block.children.forEach(child => {
                                    if (child.type === 'Declaration') {
                                        declarations.push(child as Declaration);
                                    }
                                });
                            }

                            if (declarations.length > 0) {
                                if (ruleMap.has(cleanSel)) {
                                    ruleMap.get(cleanSel)!.push(...declarations);
                                } else {
                                    ruleMap.set(cleanSel, [...declarations]);
                                }
                            }
                            
                            // Analysis for Unused Classes
                            let match;
                            classTokenRegex.lastIndex = 0;
                            while ((match = classTokenRegex.exec(sel)) !== null) {
                                usedTokenClasses.add(match[1]);
                            }

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

    // 5. 生成结果 (HTML Cleaning & Optimization)
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Helper to clean a single node
    const cleanupNode = (node: HTMLElement, original: Element) => {
        // A. Remove Hidden Elements
        const computed = window.getComputedStyle(original);
        if (computed.display === 'none') {
            node.remove();
            return false;
        }

        // B. Remove Self-Pollution
        if (node.style.outline) node.style.removeProperty('outline');
        if (node.style.outlineOffset) node.style.removeProperty('outline-offset');
        if (node.style.cursor) node.style.removeProperty('cursor');
        if (node.getAttribute('style')?.trim() === '') node.removeAttribute('style');

        // C. Clean Vue Attributes
        const attrs = Array.from(node.attributes);
        for (const attr of attrs) {
            if (attr.name.startsWith('data-v-')) {
                node.removeAttribute(attr.name);
            }
        }
        return true;
    };

    // Recursive Cleaning
    const walkClean = (cloneNode: Element, originalNode: Element) => {
        if (!(cloneNode instanceof HTMLElement)) return;
        const kept = cleanupNode(cloneNode, originalNode);
        if (!kept) return; 

        const cloneChildren = Array.from(cloneNode.children);
        const origChildren = Array.from(originalNode.children);
        
        for (let i = 0; i < cloneChildren.length; i++) {
            if (origChildren[i]) {
                walkClean(cloneChildren[i], origChildren[i]);
            }
        }
    };
    
    walkClean(clone, element);

    // 6. Class Optimization on the CLEANED clone
    const allClonedElements = [clone, ...Array.from(clone.querySelectorAll('*'))];
    
    allClonedElements.forEach((el) => {
        if (el instanceof HTMLElement) {
             const classes = Array.from(el.classList);
             if (classes.length > 0) {
                 const keptClasses = classes.filter(c => usedTokenClasses.has(c));
                 if (keptClasses.length > 0) {
                     el.className = keptClasses.join(' ');
                 } else {
                     el.removeAttribute('class');
                 }
             }
        }
    });

    // 7. Generate Final CSS String with Property Deduplication
    const cssResult = Array.from(ruleMap.entries())
        .map(([sel, declarations]) => {
            // Deduplicate logic: Map<property, Declaration>
            // Respect source order: later overrides earlier.
            // Respect !important: existing important prevents overwrite by non-important.
            
            const uniqueDecls = new Map<string, Declaration>();
            
            declarations.forEach(decl => {
                const prop = decl.property;
                const newIsImportant = decl.important === true || decl.important === 'true'; // css-tree types can vary slightly or be bool/string
                
                if (uniqueDecls.has(prop)) {
                    const existing = uniqueDecls.get(prop)!;
                    const existingIsImportant = existing.important === true || existing.important === 'true';
                    
                    // If existing is important and new matches NOT, keep existing
                    if (existingIsImportant && !newIsImportant) {
                        return; 
                    }
                }
                
                // Otherwise overwrite
                uniqueDecls.set(prop, decl);
            });
            
            const blockContent = Array.from(uniqueDecls.values())
                .map(decl => generate(decl))
                .join('; ');
                
            return `${sel} { ${blockContent} }`;
        })
        .join('\n');

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
