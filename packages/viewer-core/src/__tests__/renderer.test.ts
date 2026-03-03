import { describe, it, expect } from 'vitest';
import { detectFormat, requiresApi } from '../renderer.js';

describe('detectFormat', () => {
  it('detects PDF files', () => {
    expect(detectFormat('/deck.pdf')).toBe('pdf');
    expect(detectFormat('https://example.com/doc.PDF')).toBe('pdf');
    expect(detectFormat('/file.pdf?token=abc')).toBe('pdf');
    expect(detectFormat('/file.pdf#page=2')).toBe('pdf');
  });

  it('detects image files', () => {
    expect(detectFormat('/photo.png')).toBe('image');
    expect(detectFormat('/photo.jpg')).toBe('image');
    expect(detectFormat('/photo.jpeg')).toBe('image');
    expect(detectFormat('/photo.webp')).toBe('image');
    expect(detectFormat('/photo.gif')).toBe('image');
    expect(detectFormat('/photo.bmp')).toBe('image');
    expect(detectFormat('/photo.svg')).toBe('image');
    expect(detectFormat('/photo.PNG')).toBe('image');
    expect(detectFormat('/photo.jpg?w=800')).toBe('image');
  });

  it('returns unsupported for Office docs and video', () => {
    expect(detectFormat('/doc.docx')).toBe('unsupported');
    expect(detectFormat('/slides.pptx')).toBe('unsupported');
    expect(detectFormat('/sheet.xlsx')).toBe('unsupported');
    expect(detectFormat('/video.mp4')).toBe('unsupported');
  });

  it('returns unsupported for unknown extensions', () => {
    expect(detectFormat('/file.txt')).toBe('unsupported');
    expect(detectFormat('/file.html')).toBe('unsupported');
    expect(detectFormat('/file.zip')).toBe('unsupported');
  });
});

describe('requiresApi', () => {
  it('returns true for Office documents', () => {
    expect(requiresApi('/doc.docx')).toBe(true);
    expect(requiresApi('/doc.doc')).toBe(true);
    expect(requiresApi('/slides.pptx')).toBe(true);
    expect(requiresApi('/slides.ppt')).toBe(true);
    expect(requiresApi('/sheet.xlsx')).toBe(true);
    expect(requiresApi('/sheet.xls')).toBe(true);
    expect(requiresApi('/doc.odt')).toBe(true);
    expect(requiresApi('/slides.odp')).toBe(true);
    expect(requiresApi('/doc.rtf')).toBe(true);
  });

  it('returns true for video files', () => {
    expect(requiresApi('/video.mp4')).toBe(true);
    expect(requiresApi('/video.mov')).toBe(true);
    expect(requiresApi('/video.webm')).toBe(true);
  });

  it('returns false for PDF and images', () => {
    expect(requiresApi('/deck.pdf')).toBe(false);
    expect(requiresApi('/photo.png')).toBe(false);
    expect(requiresApi('/photo.jpg')).toBe(false);
    expect(requiresApi('/photo.webp')).toBe(false);
  });

  it('handles query strings and fragments', () => {
    expect(requiresApi('/doc.docx?token=abc')).toBe(true);
    expect(requiresApi('/doc.docx#page=1')).toBe(true);
    expect(requiresApi('/photo.png?w=800')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(requiresApi('/DOC.DOCX')).toBe(true);
    expect(requiresApi('/video.MP4')).toBe(true);
    expect(requiresApi('/photo.PNG')).toBe(false);
  });
});
