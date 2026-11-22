// Every scenario the game can play, in the order the card lists them.
import type { Scenario } from '../scenario';
import { CANTERBURY } from './canterbury';
import { DONNAGER } from './donnager';
import { TYCHO } from './tycho';
import { EROS } from './eros';
import { ANUBIS } from './anubis';
import { VENUS } from './venus';

export const SCENARIOS: Scenario[] = [CANTERBURY, DONNAGER, TYCHO, EROS, ANUBIS, VENUS];
