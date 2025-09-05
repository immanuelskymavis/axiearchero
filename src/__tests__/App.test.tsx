import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('renders Factory logo', () => {
    render(<App />);
    const logoElement = screen.getByAltText('Factory logo');
    expect(logoElement).toBeInTheDocument();
    // Expect the authentic Factory logo SVG
    expect(logoElement.getAttribute('src')).toBe('/assets/logo.svg');
  });

  it('renders Factory wordmark', () => {
    render(<App />);
    const wordmarkElement = screen.getByAltText('Factory wordmark');
    expect(wordmarkElement).toBeInTheDocument();
    expect(wordmarkElement.getAttribute('src')).toBe('/assets/wordmark.png');
  });
});
