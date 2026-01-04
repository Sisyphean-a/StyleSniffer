export class Toast {
  private element: HTMLElement | null = null;
  private timeout: any = null;

  show(text: string, duration: number = 2000) {
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.id = 'style-sniffer-toast';
      Object.assign(this.element.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        zIndex: '2147483647',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        pointerEvents: 'none',
        transition: 'opacity 0.2s',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        opacity: '0',
      });
      document.body.appendChild(this.element);
    }

    this.element.textContent = text;
    // Force reflow
    this.element.offsetHeight; 
    this.element.style.opacity = '1';

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.element) this.element.style.opacity = '0';
    }, duration);
  }
}

export const toast = new Toast();
