import type { Direction, Status } from './types.js';

/**
 * Canonical Kanban order (spec §7.1). Transitions advance or retreat exactly
 * one step along this array; there are no multi-step moves by construction (Q1).
 */
export const ORDER = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;

/**
 * The state one step forward, or `null` if `current` is the terminal `done`
 * (no forward target → illegal move → 409).
 */
export function nextState(current: Status): Status | null {
  const index = ORDER.indexOf(current);
  if (index < 0 || index === ORDER.length - 1) {
    return null;
  }
  return ORDER[index + 1] ?? null;
}

/**
 * The state one step backward, or `null` if `current` is `backlog`
 * (no backward target → illegal move → 409).
 */
export function prevState(current: Status): Status | null {
  const index = ORDER.indexOf(current);
  if (index <= 0) {
    return null;
  }
  return ORDER[index - 1] ?? null;
}

/**
 * Resolve the target state for a status move, or `null` when the move is illegal
 * (forward out of `done`, backward out of `backlog`).
 */
export function targetState(current: Status, direction: Direction): Status | null {
  return direction === 'forward' ? nextState(current) : prevState(current);
}
