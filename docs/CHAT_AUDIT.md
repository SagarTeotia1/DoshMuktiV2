# Acharya Madhav chat - audit

Line numbers refer to the code before this change (Backend/src/modules/chat/service.ts v1).

## Findings
Retrieval
- HIGH service.ts:296 book retrieval ran only on profile.problem, null on turn 1. Fixed: intent text = last 3 user turns + stored problem.
- HIGH products/service.ts:186-213 recommendations were purpose-match + featured only. No stock check, no keyword relevance. Fixed: getChatCatalog() with real in-stock flag and price (active non-Sidhi variants); rankCatalog reranks by purpose, keyword overlap, featured.
- MED purpose came only from the LLM. Fixed: mapIntentToPurposes (English, Hinglish, Devanagari).
- MED Embeddings exist for book chunks only; products use keyword plus purpose hybrid. Product embeddings are a future option.
- LOW Mulank/DOB facts never influence product choice (no planet metadata on products).

Grounding and hallucination
- HIGH prompt said not to name products but nothing enforced it. Fixed: model gets a real in-stock list and answers with slugs; groundProducts drops unknown or out-of-stock; scrubReply strips non-card rupee amounts and foreign URLs. Residual: product names typed in prose cannot be reliably detected.
- HIGH old prompt demanded cold-reading style facts and a product push every turn. Replaced by: understand, one question if unclear, 1-3 products with reasons, honest expectation, next step.
- MED no guarantee/medical/financial guardrails. Added in prompt.ts and enforced by scrubReply.

Injection and abuse
- HIGH unfiltered user text; forgeable client assistant turns. Fixed: sanitize, caps (700 user / 500 assistant chars), last 12 messages, last message must be user, injection attempts short-circuit without an LLM call. Server-side stored history would fully fix forged assistant turns.
- MED limits: 15/min route + 60/day/IP. Burst lowered to 10/min. chatDailyCount key is named for sessionId but used with IP.

PII
- MED DOB/phone go to OpenRouter and are stored in Redis (30 d) and ChatLead. Prompt no longer echoes phone and asks once, after giving value.

Latency, memory, fallbacks, analytics
- MED non-streaming JSON completion; loader shown for the whole generation. Not changed. Replies capped to about 60 words; catalog and book retrieval run in parallel.
- MED context was 20 x 2000 chars; now 12 messages with tighter caps.
- OK failures degrade to canned reply, salvaged reply, or no cards.
- LOW no impression/click or fallback-rate analytics; log CHAT_PROMPT_VERSION and grounding drops.

## Changed files
- NEW Backend/src/modules/chat/grounding.ts, prompt.ts
- Backend/src/modules/chat/service.ts, schema.ts, controller.ts, routes.ts
- Backend/src/modules/products/service.ts (getChatCatalog), Backend/src/shared/cache/keys.ts
- Frontend: types/api.types.ts, hooks/use-acharya-chat.ts, components/chat/ChatWidget.tsx
- NEW Backend/tests/chat-grounding.test.mts (run: npx tsx --test tests/chat-grounding.test.mts)

## Not verifiable without a live LLM
Persona quality, Hinglish mirroring, JSON compliance of suggestedSlugs/followUps, length adherence.

## Env
No new vars (OPENROUTER_API_KEY, OPENROUTER_MODEL as before).
