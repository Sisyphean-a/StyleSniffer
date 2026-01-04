import { parse, walk, generate } from 'css-tree';
import type { CssNode, Rule } from 'css-tree';

export interface ExtractedRule {
  selector: string;
  cssText: string;
  specificity?: number; // TODO: Calculate specificity
}

/**
 * 解析 CSS 文本并提取匹配特定 DOM 的规则
 * @param cssText 原始 CSS 文本
 * @param domSnapshot DOM 快照（简化版，包含类名、ID、标签等）
 */
export function parseAndMatch(cssText: string, domSnapshot: any): string[] {
  // TODO: css-tree might be heavy. 
  // If running in Main Thread (Popup/Content), be careful.
  // Best suited for Offscreen Document or Worker.
  
  const ast = parse(cssText);
  const matchedRules: string[] = [];

  walk(ast, {
    visit: 'Rule',
    enter: (node: CssNode) => {
      const rule = node as Rule;
      // TODO: Implement selector matching logic
      // This is the hard part: reverse matching AST selectors against a DOM snapshot
      // For POC, we might just return everything or implement basic matching
      
      const block = generate(rule.block);
      const prelude = generate(rule.prelude);
      
      // Simple Mock Match: if selector contains '.'
      if (prelude.includes('.')) {
         matchedRules.push(`${prelude} ${block}`);
      }
    }
  });

  return matchedRules;
}
