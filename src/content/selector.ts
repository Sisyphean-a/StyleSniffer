import { toast } from './ui';

export class Selector {
  private isActive: boolean = false;
  private baseElement: HTMLElement | null = null;
  private currentSelection: HTMLElement | null = null;
  private level: number = 0;
  private overlay: HTMLElement | null = null;

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
  }

  public activate() {
    if (this.isActive) return;
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('wheel', this.handleWheel, { passive: false });
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('mouseout', this.handleMouseOut);
    toast.show("🚀 模式已开启");
  }

  public deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    document.body.style.cursor = '';
    this.clearHighlight();
    this.baseElement = null;
    this.level = 0;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('mouseout', this.handleMouseOut);
    toast.show("💤 模式已关闭");
  }

  public toggle() {
    this.isActive ? this.deactivate() : this.activate();
  }

  private clearHighlight() {
    if (this.currentSelection) {
      // 移除样式时不再检查颜色值，因为浏览器可能会转换颜色格式 (如 rgb vs hex) 导致匹配失败
      // 直接清除 outline 样式
      this.currentSelection.style.outline = '';
      this.currentSelection = null;
    }
  }

  private updateHighlight() {
    if (!this.baseElement) return;
    let target: HTMLElement = this.baseElement;
    
    // Go up the tree based on scroll Level
    for (let i = 0; i < this.level; i++) {
        if (target.parentElement) target = target.parentElement;
    }
    
    if (this.currentSelection !== target) {
        this.clearHighlight();
        this.currentSelection = target;
        const color = this.level === 0 ? '#ff0055' : '#00aaff';
        this.currentSelection.style.outline = `3px solid ${color}`;
        this.currentSelection.style.outlineOffset = '-2px';
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isActive) return;
    const target = e.target as HTMLElement;
    // Avoid highlighting the toast or our own UI (if any)
    if (target !== this.baseElement && target.id !== 'style-sniffer-toast') {
        this.baseElement = target;
        this.level = 0;
        this.updateHighlight();
    }
  }

  private handleMouseOut(e: MouseEvent) {
     if (!e.relatedTarget) this.clearHighlight();
  }

  private handleWheel(e: WheelEvent) {
    if (!this.isActive || !this.baseElement) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY < 0) {
        // Scroll Up: Select Parent
        if (this.currentSelection && this.currentSelection.parentElement && this.currentSelection.tagName !== 'BODY') {
            this.level++;
            this.updateHighlight();
            toast.show(`⬆ 选中父级：<${this.currentSelection.tagName.toLowerCase()}>`);
        }
    } else {
        // Scroll Down: Select Child (Back to base)
        if (this.level > 0) {
            this.level--;
            this.updateHighlight();
            if (this.currentSelection) {
                toast.show(`⬇ 选中子级：<${this.currentSelection.tagName.toLowerCase()}>`);
            }
        }
    }
  }

  private async copyToClipboard(text: string) {
      try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
          } else {
              throw new Error('Clipboard API unavailable');
          }
      } catch (e) {
          // Fallback mechanism
          const textArea = document.createElement("textarea");
          textArea.value = text;
          
          // Ensure it's not visible but part of the DOM
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          
          textArea.focus();
          textArea.select();
          
          return new Promise<void>((resolve, reject) => {
              const successful = document.execCommand('copy');
              document.body.removeChild(textArea);
              if (successful) {
                  resolve();
              } else {
                  reject(new Error('Fallback copy failed'));
              }
          });
      }
  }

  private async handleClick(e: MouseEvent) {
    if (!this.isActive || !this.currentSelection) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = this.currentSelection;
    target.style.outline = '4px solid #00ff00';
    toast.show("⏳ 正在提取...", 10000);

    try {
        const { extractor } = await import('./extractor');
        const code = await extractor.extract(target);
        await this.copyToClipboard(code);
        toast.show("✅ 已复制到剪贴板！", 3000);
    } catch (err) {
        console.error(err);
        toast.show("❌ 提取失败: " + err, 5000);
    } finally {
        this.deactivate();
    }
  }
}

export const selector = new Selector();
