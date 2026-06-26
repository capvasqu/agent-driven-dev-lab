import { describe, expect, it } from 'vitest';
import {
  ORDER,
  nextState,
  prevState,
  targetState,
} from '../src/domain/transitions.js';
import type { Status } from '../src/domain/types.js';

// Domain unit tests for the pure Kanban transition helpers (spec §7).
// These pin down the legal-move table verbatim:
//
//   backlog → todo → in_progress → review → done
//
// with the two boundary cases (forward out of `done`, backward out of
// `backlog`) returning null so the caller can map them to a 409.

describe('ORDER', () => {
  it('is the canonical five-state Kanban flow', () => {
    expect([...ORDER]).toEqual(['backlog', 'todo', 'in_progress', 'review', 'done']);
  });
});

describe('nextState (forward)', () => {
  it('advances exactly one step along the flow', () => {
    expect(nextState('backlog')).toBe('todo');
    expect(nextState('todo')).toBe('in_progress');
    expect(nextState('in_progress')).toBe('review');
    expect(nextState('review')).toBe('done');
  });

  it('returns null at the terminal `done` (no forward target)', () => {
    expect(nextState('done')).toBeNull();
  });
});

describe('prevState (backward)', () => {
  it('retreats exactly one step along the flow', () => {
    expect(prevState('done')).toBe('review');
    expect(prevState('review')).toBe('in_progress');
    expect(prevState('in_progress')).toBe('todo');
    expect(prevState('todo')).toBe('backlog');
  });

  it('returns null at the boundary `backlog` (no backward target)', () => {
    expect(prevState('backlog')).toBeNull();
  });
});

describe('targetState (direction dispatch)', () => {
  it('matches the full legal-move table from spec §7.2', () => {
    const table: Array<[Status, Status | null, Status | null]> = [
      // [from, forward, backward]
      ['backlog', 'todo', null],
      ['todo', 'in_progress', 'backlog'],
      ['in_progress', 'review', 'todo'],
      ['review', 'done', 'in_progress'],
      ['done', null, 'review'],
    ];
    for (const [from, fwd, back] of table) {
      expect(targetState(from, 'forward')).toBe(fwd);
      expect(targetState(from, 'backward')).toBe(back);
    }
  });

  it('walks a task forward and then backward through the whole chain', () => {
    // Forward all the way to done.
    let s: Status = 'backlog';
    const forwardPath: Status[] = [];
    let n = targetState(s, 'forward');
    while (n) {
      forwardPath.push(n);
      s = n;
      n = targetState(s, 'forward');
    }
    expect(forwardPath).toEqual(['todo', 'in_progress', 'review', 'done']);

    // Backward all the way to backlog.
    const backwardPath: Status[] = [];
    let p = targetState(s, 'backward');
    while (p) {
      backwardPath.push(p);
      s = p;
      p = targetState(s, 'backward');
    }
    expect(backwardPath).toEqual(['review', 'in_progress', 'todo', 'backlog']);
  });
});
