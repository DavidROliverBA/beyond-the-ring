// Every scenario the game can play, in the order the card lists them.
import type { Scenario } from '../scenario';
import { CANTERBURY } from './canterbury';
import { DONNAGER } from './donnager';
import { TYCHO } from './tycho';

export const SCENARIOS: Scenario[] = [CANTERBURY, DONNAGER, TYCHO];
