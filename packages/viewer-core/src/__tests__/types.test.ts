import { describe, it, expectTypeOf } from 'vitest';
import type {
  CloakViewerProps,
  CloakViewEvent,
  CloakReadyEvent,
  CloakErrorEvent,
  CloakErrorCode,
} from '../types.js';

describe('type exports', () => {
  it('CloakViewerProps has required src field', () => {
    expectTypeOf<CloakViewerProps>().toHaveProperty('src');
    expectTypeOf<CloakViewerProps['src']>().toBeString();
  });

  it('CloakViewerProps has optional fields', () => {
    expectTypeOf<CloakViewerProps>().toHaveProperty('watermark');
    expectTypeOf<CloakViewerProps>().toHaveProperty('emailGate');
    expectTypeOf<CloakViewerProps>().toHaveProperty('password');
    expectTypeOf<CloakViewerProps>().toHaveProperty('theme');
    expectTypeOf<CloakViewerProps>().toHaveProperty('allowDownload');
    expectTypeOf<CloakViewerProps>().toHaveProperty('expires');
    expectTypeOf<CloakViewerProps>().toHaveProperty('apiKey');
    expectTypeOf<CloakViewerProps>().toHaveProperty('renderer');
    expectTypeOf<CloakViewerProps>().toHaveProperty('branding');
  });

  it('CloakViewEvent has expected shape', () => {
    expectTypeOf<CloakViewEvent>().toHaveProperty('page');
    expectTypeOf<CloakViewEvent>().toHaveProperty('email');
    expectTypeOf<CloakViewEvent>().toHaveProperty('timestamp');
    expectTypeOf<CloakViewEvent>().toHaveProperty('sessionId');
    expectTypeOf<CloakViewEvent>().toHaveProperty('duration');
    expectTypeOf<CloakViewEvent>().toHaveProperty('device');
  });

  it('CloakReadyEvent has expected shape', () => {
    expectTypeOf<CloakReadyEvent>().toHaveProperty('pageCount');
    expectTypeOf<CloakReadyEvent>().toHaveProperty('format');
  });

  it('CloakErrorEvent has expected shape', () => {
    expectTypeOf<CloakErrorEvent>().toHaveProperty('code');
    expectTypeOf<CloakErrorEvent>().toHaveProperty('message');
  });

  it('CloakErrorCode covers all error codes', () => {
    const codes: CloakErrorCode[] = [
      'LOAD_FAILED',
      'PARSE_FAILED',
      'EXPIRED',
      'PASSWORD_REQUIRED',
      'PASSWORD_INCORRECT',
      'EMAIL_REQUIRED',
      'API_ERROR',
      'API_UNAUTHORIZED',
      'UNSUPPORTED_FORMAT',
      'RENDER_ERROR',
    ];
    expectTypeOf(codes).toEqualTypeOf<CloakErrorCode[]>();
  });
});
