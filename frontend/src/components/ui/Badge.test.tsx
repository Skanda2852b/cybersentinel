import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Critical</Badge>);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('applies default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('badge-info');
  });

  it('applies critical variant', () => {
    render(<Badge variant="critical">Critical</Badge>);
    expect(screen.getByText('Critical')).toHaveClass('badge-critical');
  });

  it('applies high variant', () => {
    render(<Badge variant="high">High</Badge>);
    expect(screen.getByText('High')).toHaveClass('badge-high');
  });

  it('applies medium variant', () => {
    render(<Badge variant="medium">Medium</Badge>);
    expect(screen.getByText('Medium')).toHaveClass('badge-medium');
  });

  it('applies low variant', () => {
    render(<Badge variant="low">Low</Badge>);
    expect(screen.getByText('Low')).toHaveClass('badge-low');
  });

  it('applies info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info')).toHaveClass('badge-info');
  });

  it('applies success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('badge-success');
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    expect(screen.getByText('Custom')).toHaveClass('custom-badge');
  });
});
