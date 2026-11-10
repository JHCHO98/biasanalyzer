# Content recommendations (E5 + LLM)

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe models/server.py
```

Analyze actual watch history and open **다음 콘텐츠**. Select **검색어 제안받기**
to obtain three editable queries and a topic summary from the LLM. Search one
query or select **제안 검색어 모두 검색**. Manual search remains available.

The browser uses the existing YouTube API key to search up to 25 videos per
query (at most three queries), deduplicates IDs, loads full descriptions in
batches, and submits the pool to E5. After ranking, the server asks the LLM for
reasons grounded in the chosen candidates. Changing diversity reranks the pool
without repeating YouTube searches; explanation requests use a short-lived cache.

## LLM provider configuration

Set `LLM_PROVIDER` to `openai` (the default) or `anthropic` (`claude` is also
accepted as an alias). The server reads the selected provider's key from its
environment. Never put either key in React or a `REACT_APP_*` variable.
`models/server.py` automatically loads the repository-root `.env` file, which
Git ignores. Use `.env.example` as a template. Existing process environment
variables take precedence over `.env` settings.

OpenAI:

```powershell
# OPENAI_API_KEY must already be set in this process environment.
$env:LLM_PROVIDER='openai'
$env:OPENAI_MODEL='gpt-6-luna'
$env:OPENAI_REASONING_EFFORT='none'
.\.venv\Scripts\python.exe models/server.py
```

Claude:

```powershell
# ANTHROPIC_API_KEY must already be set in this process environment.
$env:LLM_PROVIDER='anthropic'
$env:ANTHROPIC_MODEL='claude-haiku-5-5'
.\.venv\Scripts\python.exe models/server.py
```

Both providers use native structured outputs with the same Pydantic validation.
OpenAI uses `responses.parse` and `store=False`; Anthropic uses `messages.parse`
with `output_format` (the SDK sends `output_config.format`). Neither sends the
other provider's credentials or unsupported request parameters. Both use a
25-second timeout, no automatic retries, and a 2,200-token output limit.

Repeated validated responses are cached in memory for 10 minutes, with at most
128 entries. The cache separates provider, model, task, diversity/context, and
credential. A provider switch cannot reuse the other provider's output. No LLM
payload is persisted in the vector database. Missing/invalid credentials do not
silently switch providers; manual search and E5 results remain available.

Only topic counts and up to three title/description examples per topic (eight
topics maximum) are sent for the interest summary. Comments, bias scores, channel
names, and credentials are omitted. Explanation requests also include metadata
for at most six ranked candidate videos. Their ID set must match the response;
each returned evidence phrase must occur in that candidate's supplied title or
description. This anchors the explanation, but does not verify the video's facts.

On LLM failures the UI keeps manual search and E5 results available. Explanation
failures show the original semantic-match reason and a separate retry control;
no new YouTube search or embedding calculation is required to retry a reason.

The API binds to `127.0.0.1` by default. `FRONTEND_ORIGINS` defaults to localhost
and 127.0.0.1 on ports 3000/3100. Configure that comma-separated list if the React
development server uses another origin. `BIASANALYZER_HOST` overrides the bind
address when explicitly configured.

## LLM endpoints

- `POST /api/recommendations/queries`: `history` (same bounded video schema below)
  and `diversity` (0–1). Returns `summary`, exactly three distinct `queries`
  (`query`, `purpose`, `reason`), `provider`, `model`, and `cached`. Purpose is `related`,
  `background`, or `adjacent`. Does not itself search YouTube.
- `POST /api/recommendations/explain`: `history` and 1–6 `recommendations`
  (video fields plus `matched_topic`). Returns `explanations` (`id`, `reason`,
  literal `evidence`), `provider`, `model`, and `cached`. Does not change ranking or links.
- Errors use `detail.code` and `detail.message`: missing key/authentication or
  connection failures return 503, provider limits 429, invalid model output or
  unsupported evidence 502, and invalid input/refusals 422.

Implementation references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
Claude references: [Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
and [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

## Model and cache

The default is `intfloat/multilingual-e5-small`, loaded lazily on the first ranking
request. First use needs network access to download the model. The default CPU
device avoids competing with the ELECTRA classifiers for GPU memory.

Set environment variables **before** starting the server:

```powershell
$env:EMBEDDING_MODEL='intfloat/multilingual-e5-base'
$env:EMBEDDING_DEVICE='cpu' # or cuda when available
$env:EMBEDDING_REVISION='main' # pin a model commit for reproducible evaluation
```

`nlpai-lab/KURE-v1` can also be selected with `EMBEDDING_MODEL`. It is a comparison
candidate; no claim of better YouTube recommendation quality has been measured.
E5 inputs use `query:` for history and `passage:` for candidates. KURE inputs have
no prefix. Inputs are limited to 512 tokens, including when using KURE.

Model downloads and a SQLite vector cache live in `models/.cache/embeddings/`,
which Git ignores. Override with `EMBEDDING_CACHE_DIR`. Cache keys include video
ID, cleaned text, role, model revision, and preprocessing version. Model changes
therefore recompute vectors; the persistent vector cache is capped at 20,000 rows.

## API

`POST /api/recommendations/rank` accepts:

```json
{
  "history": [{"id": "abcdefghijk", "title": "전력망과 태양광", "description": "", "topic": "과학과 기술"}],
  "candidates": [{"id": "lmnopqrstuv", "title": "재생에너지 전력망 해설", "description": "전력 공급과 수요를 설명합니다.", "channel": "과학 채널"}],
  "limit": 6,
  "diversity": 0.35
}
```

History supports 1–500 videos and candidates 1–100; IDs must be 11-character
YouTube IDs. The response includes recommendations, matched topics, cosine
similarities, model name, topic counts, and excluded candidate counts. Watched IDs,
matching watched titles, and duplicate titles/IDs are excluded before embedding.
An entirely excluded pool returns an empty result without loading the model.
Unavailable models return HTTP 503; invalid inputs return 422.

History is grouped by existing topic labels, with a normalized mean vector per
group. Ranking uses the best topic match, then applies a diversity-dependent
penalty for similar selections/repeated channels and a bonus for topic coverage.
Similarity is neither confidence nor a political stance measure. The diversity
control does not establish viewpoint balance or demonstrate reduced bias.

## Checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s models/tests -v
cd react/front
npm test -- --watchAll=false --runInBand --runTestsByPath src/components/EmbeddingRecommendations.test.jsx
npm run build
```

Tests cover ranking invariants, cache invalidation, API validation, visible model
failure, and frontend reranking without repeated searches. LLM tests use the real
OpenAI and Anthropic SDKs with mocked HTTP transports; no live key or paid request is needed.
They cover schema parsing, refusal/timeout/rate-limit handling, grounding, bounded
history summaries, and retaining E5 results after explanation failures.
Quality evaluation on
human-labeled Korean video recommendations is still needed before choosing a
larger model or claiming a nudge effect.
