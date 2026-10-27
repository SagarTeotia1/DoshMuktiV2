// Run: npx tsx --test tests/chat-guidance.test.mts
// Guidance-first gate: product cards only on an explicit ask, or after a few turns when the model is ready.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canShowProducts, wantsProducts, MAX_RECOMMENDED_PRODUCTS } from '../src/modules/chat/intent';
import { buildSystemPrompt, CHAT_PROMPT_VERSION } from '../src/modules/chat/prompt';
import { EMPTY_PROFILE } from '../src/modules/chat/schema';

describe('wantsProducts', () => {
  const yes = [
    'koi upay batao', 'which product should I buy', 'iska price kya hai', 'kya lu isme se', 'bracelet chahiye',
    'mujhe yantra suggest karo', 'kitne ka hai ye', 'link bhejo', 'कोई उपाय बताइए', 'मुझे खरीदना है', 'ब्रेसलेट दिखाओ',
  ];
  const no = [
    'meri job mein dikkat hai', 'I feel stuck and anxious', 'mera DOB 12/05/1995 hai', 'haan', 'shaadi mein deri ho rahi hai',
    'mujhe neend nahi aati', 'mera naam Rohan hai', '',
  ];
  for (const t of yes) test(`asks: "${t}"`, () => assert.equal(wantsProducts(t), true));
  for (const t of no) test(`no ask: "${t}"`, () => assert.equal(wantsProducts(t), false));
});

describe('canShowProducts', () => {
  test('explicit ask always shows, even on turn 1', () => assert.equal(canShowProducts({ asked: true, userTurns: 1, modelReady: false }), true));
  test('model ready but too early -> hidden', () => {
    assert.equal(canShowProducts({ asked: false, userTurns: 1, modelReady: true }), false);
    assert.equal(canShowProducts({ asked: false, userTurns: 2, modelReady: true }), false);
  });
  test('model ready after guidance turns -> shown', () => assert.equal(canShowProducts({ asked: false, userTurns: 3, modelReady: true }), true));
  test('not ready, no ask, many turns -> hidden', () => assert.equal(canShowProducts({ asked: false, userTurns: 9, modelReady: false }), false));
  test('never more than 2 cards', () => assert.equal(MAX_RECOMMENDED_PRODUCTS, 2));
});

describe('prompt v3', () => {
  const p = buildSystemPrompt({ profile: EMPTY_PROFILE, bookChunks: [], kundliFacts: null, candidates: [], turnNumber: 1 });
  test('version bumped', () => assert.equal(CHAT_PROMPT_VERSION, 'acharya-v3'));
  test('guide-first, not salesperson', () => assert.match(p, /GUIDE FIRST, NOT A SALESPERSON/));
  test('products capped at 2 and optional', () => {
    assert.match(p, /at most 2 products/);
    assert.match(p, /max 2/);
    assert.doesNotMatch(p, /recommend 1-3/);
  });
  test('no urgency / scarcity', () => assert.match(p, /never use urgency or scarcity/i));
  test('no products when none matched', () => assert.match(p, /Do NOT recommend any product this turn/));
});
