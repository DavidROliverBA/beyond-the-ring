// Every scenario the game can play, in the order the card lists them.
import type { Scenario } from '../scenario';
import { CANTERBURY } from './canterbury';
import { DONNAGER } from './donnager';
import { ANUBIS } from './anubis';
import { VENUS } from './venus';

export const SCENARIOS: Scenario[] = [CANTERBURY, DONNAGER, ANUBIS, VENUS];
