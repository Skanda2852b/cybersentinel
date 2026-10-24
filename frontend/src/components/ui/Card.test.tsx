import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader } from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default padding', () => {
    render(<Card>Padded</Card>);
    expect(screen.getByText('Padded')).toHaveClass('p-6');
  });

  it('applies sm padding', () => {
    render(<Card padding="sm">Small pad</Card>);
    expect(screen.getByText('Small pad')).toHaveClass('p-4');
  });

  it('applies lg padding', () => {
    render(<Card padding="lg">Large pad</Card>);
    expect(screen.getByText('Large pad')).toHaveClass('p-8');
  });

  it('applies no padding', () => {
    render(<Card padding="none">No pad</Card>);
    expect(screen.getByText('No pad')).not.toHaveClass(/p-/);
  });

  it('accepts custom className', () => {
    render(<Card className="custom-card">Custom</Card>);
    expect(screen.getByText('Custom')).toHaveClass('custom-card');
  });
});

describe('CardHeader', () => {
  it('renders title', () => {
    render(<CardHeader title="Alert Details" />);
    expect(screen.getByText('Alert Details')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<CardHeader title="Title" description="Description text" />);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<CardHeader title="Title" action={<button>Action</button>} />);
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });
});
