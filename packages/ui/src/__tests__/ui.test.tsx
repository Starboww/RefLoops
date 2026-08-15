import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/Button';
import { StatusPill } from '../components/StatusPill';

describe('UI Component Library', () => {
  it('renders primary button correctly', () => {
    render(<Button variant="primary">Click Me</Button>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeDefined();
  });

  it('renders StatusPill for all 12 statuses', () => {
    const statuses = [
      'ACTIVE',
      'ARCHIVED',
      'CLOSED',
      'REFERRAL_RECEIVED',
      'PENDING',
      'ACCEPTED',
      'EXPIRED',
      'DECLINED_OR_REMOVED',
      'QUEUED',
      'READY_TO_SEND',
      'SENT',
      'CANCELLED_BY_USER',
      'SCHEDULED',
      'SKIPPED',
      'NOT_SCHEDULED',
    ] as const;

    for (const s of statuses) {
      const { container } = render(<StatusPill status={s} />);
      expect(container.textContent).toBeTruthy();
    }
  });
});
