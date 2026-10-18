import { INR } from '../lib/money';
import type { EngineSettings, Tier } from './types';

/** The tiers from the project doc, section 4.4. Every value is editable in Settings. */
export const DEFAULT_TIERS: Tier[] = [
  { name: 'small', maxPercent: 3, multiple: 1, coolingOffDays: 1 },
  { name: 'medium', maxPercent: 15, multiple: 2, coolingOffDays: 7 },
  { name: 'large', maxPercent: 40, multiple: 3, coolingOffDays: 14 },
  { name: 'major', maxPercent: Infinity, multiple: 3, coolingOffDays: 30 },
];

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  currency: INR,
  bufferMonths: 1,
  tiers: DEFAULT_TIERS,
  needMultiple: 1,
};
