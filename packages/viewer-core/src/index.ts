/**
 * @cloakshare/viewer — Drop-in secure document viewer component.
 *
 * Usage:
 *   <cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>
 *
 * @see https://cloakshare.dev/embed
 */

export { CloakViewerElement } from './cloak-viewer.js';
export type {
  CloakViewerProps,
  CloakViewEvent,
  CloakReadyEvent,
  CloakErrorEvent,
  CloakErrorCode,
} from './types.js';

// Auto-register the custom element
import { CloakViewerElement } from './cloak-viewer.js';

if (typeof window !== 'undefined' && !customElements.get('cloak-viewer')) {
  customElements.define('cloak-viewer', CloakViewerElement);
}
