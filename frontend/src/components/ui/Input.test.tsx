import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Username" id="username-input" />);
    const label = screen.getByLabelText(/username/i);
    expect(label).toHaveAttribute('id', 'username-input');
  });

  it('shows error message when error prop is set', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when no error', () => {
    render(<Input label="Email" helperText="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show helper text when error is present', () => {
    render(<Input label="Email" error="Invalid" helperText="Enter email" />);
    expect(screen.queryByText('Enter email')).not.toBeInTheDocument();
  });

  it('accepts value and onChange', () => {
    const handleChange = vi.fn();
    render(<Input value="test" onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test');
    fireEvent.change(input, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
