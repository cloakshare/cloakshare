/**
 * @cloakshare/react — React wrapper for <cloak-viewer> Web Component.
 *
 * Usage:
 *   import { CloakViewer } from '@cloakshare/react';
 *   <CloakViewer src="/deck.pdf" watermark="Confidential" emailGate />
 */

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { CloakViewEvent, CloakReadyEvent, CloakErrorEvent } from '@cloakshare/viewer';

// Ensure the custom element is registered
import '@cloakshare/viewer';

export interface CloakViewerProps {
  src: string;
  watermark?: string;
  emailGate?: boolean;
  password?: string;
  email?: string;
  theme?: 'dark' | 'light';
  allowDownload?: boolean;
  expires?: string;
  apiKey?: string;
  apiUrl?: string;
  renderer?: 'auto' | 'external';
  branding?: boolean;
  width?: string;
  height?: string;

  // Event callbacks
  onView?: (event: CloakViewEvent) => void;
  onReady?: (event: CloakReadyEvent) => void;
  onError?: (event: CloakErrorEvent) => void;
  onEmailSubmitted?: (event: { email: string }) => void;

  // Standard HTML attributes
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export interface CloakViewerRef {
  /** The underlying <cloak-viewer> DOM element */
  element: HTMLElement | null;
}

/**
 * React component wrapper for <cloak-viewer>.
 * Provides typed props and event callbacks.
 */
export const CloakViewer = forwardRef<CloakViewerRef, CloakViewerProps>(
  function CloakViewer(props, ref) {
    const elRef = useRef<HTMLElement>(null);

    useImperativeHandle(ref, () => ({
      get element() {
        return elRef.current;
      },
    }));

    // Wire up event listeners
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;

      const handlers: Array<[string, EventListener]> = [];

      if (props.onView) {
        const handler = (e: Event) => props.onView!((e as CustomEvent).detail);
        el.addEventListener('cloak:view', handler);
        handlers.push(['cloak:view', handler]);
      }

      if (props.onReady) {
        const handler = (e: Event) => props.onReady!((e as CustomEvent).detail);
        el.addEventListener('cloak:ready', handler);
        handlers.push(['cloak:ready', handler]);
      }

      if (props.onError) {
        const handler = (e: Event) => props.onError!((e as CustomEvent).detail);
        el.addEventListener('cloak:error', handler);
        handlers.push(['cloak:error', handler]);
      }

      if (props.onEmailSubmitted) {
        const handler = (e: Event) =>
          props.onEmailSubmitted!((e as CustomEvent).detail);
        el.addEventListener('cloak:email-submitted', handler);
        handlers.push(['cloak:email-submitted', handler]);
      }

      return () => {
        for (const [event, handler] of handlers) {
          el.removeEventListener(event, handler);
        }
      };
    }, [props.onView, props.onReady, props.onError, props.onEmailSubmitted]);

    // Build attribute map — React doesn't natively support custom element attributes well,
    // so we set them imperatively
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;

      setAttr(el, 'src', props.src);
      setAttr(el, 'watermark', props.watermark);
      setBoolAttr(el, 'email-gate', props.emailGate);
      setAttr(el, 'password', props.password);
      setAttr(el, 'email', props.email);
      setAttr(el, 'theme', props.theme);
      setBoolAttr(el, 'allow-download', props.allowDownload);
      setAttr(el, 'expires', props.expires);
      setAttr(el, 'api-key', props.apiKey);
      setAttr(el, 'api-url', props.apiUrl);
      setAttr(el, 'renderer', props.renderer);
      setAttr(el, 'branding', props.branding === false ? 'false' : undefined);
      setAttr(el, 'width', props.width);
      setAttr(el, 'height', props.height);
    });

    // Use createElement to avoid React's JSX custom element attribute handling issues
    return React.createElement('cloak-viewer', {
      ref: elRef,
      className: props.className,
      style: props.style,
      id: props.id,
    });
  },
);

function setAttr(el: HTMLElement, name: string, value: string | undefined) {
  if (value !== undefined && value !== null) {
    el.setAttribute(name, value);
  } else {
    el.removeAttribute(name);
  }
}

function setBoolAttr(el: HTMLElement, name: string, value: boolean | undefined) {
  if (value) {
    el.setAttribute(name, '');
  } else {
    el.removeAttribute(name);
  }
}

// Re-export types
export type { CloakViewEvent, CloakReadyEvent, CloakErrorEvent, CloakErrorCode } from '@cloakshare/viewer';

// Augment JSX to recognize <cloak-viewer> in TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'cloak-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          watermark?: string;
          'email-gate'?: boolean | '';
          password?: string;
          email?: string;
          theme?: string;
          'allow-download'?: boolean | '' | 'false';
          expires?: string;
          'api-key'?: string;
          'api-url'?: string;
          renderer?: string;
          branding?: string;
          width?: string;
          height?: string;
        },
        HTMLElement
      >;
    }
  }
}
