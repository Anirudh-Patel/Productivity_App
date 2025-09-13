// Accessibility utilities for enhanced user experience

/**
 * Focus Management Utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = [];
  
  /**
   * Trap focus within a container element
   */
  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    
    // Focus first element
    firstFocusable?.focus();
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
  
  /**
   * Save current focus and set new focus
   */
  static pushFocus(element: HTMLElement) {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus) {
      this.focusStack.push(currentFocus);
    }
    element.focus();
  }
  
  /**
   * Restore previous focus
   */
  static popFocus() {
    const previousFocus = this.focusStack.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  }
  
  /**
   * Focus first element matching selector
   */
  static focusFirst(selector: string, container: Document | Element = document): boolean {
    const element = container.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      return true;
    }
    return false;
  }
}

/**
 * ARIA Live Region Manager
 */
export class LiveRegionManager {
  private static regions: Map<string, HTMLElement> = new Map();
  
  /**
   * Create or get a live region
   */
  static getRegion(id: string, politeness: 'polite' | 'assertive' = 'polite'): HTMLElement {
    let region = this.regions.get(id);
    
    if (!region) {
      region = document.createElement('div');
      region.id = `live-region-${id}`;
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only'; // Screen reader only
      region.style.cssText = `
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      `;
      
      document.body.appendChild(region);
      this.regions.set(id, region);
    }
    
    return region;
  }
  
  /**
   * Announce a message to screen readers
   */
  static announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
    const region = this.getRegion('announcements', politeness);
    
    // Clear and then set message to ensure it's announced
    region.textContent = '';
    setTimeout(() => {
      region.textContent = message;
    }, 100);
  }
  
  /**
   * Announce status changes (like loading, success, error)
   */
  static announceStatus(status: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const message = `${type}: ${status}`;
    this.announce(message, type === 'error' ? 'assertive' : 'polite');
  }
}

/**
 * Keyboard Navigation Helpers
 */
export class KeyboardNavigation {
  /**
   * Handle arrow key navigation for a list of elements
   */
  static handleArrowNavigation(
    event: KeyboardEvent, 
    items: HTMLElement[], 
    currentIndex: number,
    options: {
      vertical?: boolean;
      horizontal?: boolean;
      loop?: boolean;
    } = {}
  ): number {
    const { vertical = true, horizontal = false, loop = true } = options;
    let newIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowDown':
        if (vertical) {
          event.preventDefault();
          newIndex = loop && currentIndex === items.length - 1 ? 0 : Math.min(currentIndex + 1, items.length - 1);
        }
        break;
        
      case 'ArrowUp':
        if (vertical) {
          event.preventDefault();
          newIndex = loop && currentIndex === 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
        }
        break;
        
      case 'ArrowRight':
        if (horizontal) {
          event.preventDefault();
          newIndex = loop && currentIndex === items.length - 1 ? 0 : Math.min(currentIndex + 1, items.length - 1);
        }
        break;
        
      case 'ArrowLeft':
        if (horizontal) {
          event.preventDefault();
          newIndex = loop && currentIndex === 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
        }
        break;
        
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
        
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      items[newIndex]?.focus();
    }
    
    return newIndex;
  }
}

/**
 * Screen Reader Utilities
 */
export class ScreenReaderUtils {
  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  
  /**
   * Check if user has high contrast preference
   */
  static prefersHighContrast(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }
  
  /**
   * Get ARIA label for element, fallback to text content
   */
  static getAccessibleName(element: HTMLElement): string {
    return element.getAttribute('aria-label') || 
           element.getAttribute('aria-labelledby') ||
           element.textContent ||
           '';
  }
  
  /**
   * Set up automatic ARIA descriptions for form fields
   */
  static enhanceFormAccessibility(form: HTMLFormElement) {
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const label = form.querySelector(`label[for="${input.id}"]`);
      const helpText = form.querySelector(`[id="${input.id}-help"]`);
      const errorText = form.querySelector(`[id="${input.id}-error"]`);
      
      // Set up aria-labelledby if not already set
      if (label && !input.getAttribute('aria-labelledby')) {
        if (!label.id) {
          label.id = `${input.id}-label`;
        }
        input.setAttribute('aria-labelledby', label.id);
      }
      
      // Set up aria-describedby for help and error text
      const describedBy = [];
      if (helpText) {
        describedBy.push(helpText.id);
      }
      if (errorText) {
        describedBy.push(errorText.id);
      }
      
      if (describedBy.length > 0) {
        input.setAttribute('aria-describedby', describedBy.join(' '));
      }
    });
  }
}

/**
 * Color Contrast Utilities
 */
export class ColorContrastUtils {
  /**
   * Calculate luminance of a color
   */
  static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  
  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const lum1 = this.getLuminance(...color1);
    const lum2 = this.getLuminance(...color2);
    
    const brighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (brighter + 0.05) / (darker + 0.05);
  }
  
  /**
   * Check if color combination meets WCAG AA standards
   */
  static meetsWCAG_AA(color1: [number, number, number], color2: [number, number, number]): boolean {
    return this.getContrastRatio(color1, color2) >= 4.5;
  }
  
  /**
   * Check if color combination meets WCAG AAA standards
   */
  static meetsWCAG_AAA(color1: [number, number, number], color2: [number, number, number]): boolean {
    return this.getContrastRatio(color1, color2) >= 7;
  }
}

/**
 * Initialize accessibility features
 */
export function initializeAccessibility() {
  // Set up global accessibility features
  
  // Skip link for keyboard navigation
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    z-index: 10000;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Initialize live regions
  LiveRegionManager.getRegion('announcements');
  LiveRegionManager.getRegion('status');
  
  // Set up global keyboard event handlers
  document.addEventListener('keydown', (event) => {
    // Escape key handling
    if (event.key === 'Escape') {
      const activeModal = document.querySelector('[role="dialog"]:not([hidden])');
      if (activeModal) {
        const closeButton = activeModal.querySelector('[data-dismiss="modal"], [aria-label*="close" i]') as HTMLElement;
        closeButton?.click();
      }
    }
  });
  
  // Announce page changes for single-page applications
  let currentPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      const pageTitle = document.title;
      LiveRegionManager.announce(`Navigated to ${pageTitle}`, 'polite');
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  console.log('Accessibility features initialized');
}

// Auto-initialize when module loads (if in browser environment)
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAccessibility);
  } else {
    initializeAccessibility();
  }
}