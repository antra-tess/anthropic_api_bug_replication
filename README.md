# Anthropic API Stop Sequence Bug

## Summary

The Anthropic Messages API intermittently fails to trigger stop sequences, even when the exact stop sequence string appears in the model's output. The model continues generating text after the stop sequence, and the API returns `stop_reason: "end_turn"` instead of `stop_reason: "stop_sequence"`.

## Reproduction

```bash
npm install tsx
ANTHROPIC_API_KEY=your_key npx tsx reproduce.ts
```

## Expected Behavior

When `stop_sequences` contains `"</function_calls>"` and the model outputs that exact string:
- API should stop generation immediately
- Response should have `stop_reason: "stop_sequence"`
- Response should have `stop_sequence: "</function_calls>"`
- Output text should NOT contain content after the stop sequence

## Actual Behavior

Intermittently (~20% of requests in testing):
- API does NOT stop at the stop sequence
- Response has `stop_reason: "end_turn"`
- Response has `stop_sequence: null`
- Output text CONTAINS the stop sequence string AND additional text after it

## Example

### Request
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 500,
  "stop_sequences": ["</function_calls>"],
  "system": "You have access to a tool called \"add\". When asked to add numbers, you MUST output:\n<function_calls>\n<invoke name=\"add\">\n<parameter name=\"a\">first_number</parameter>\n<parameter name=\"b\">second_number</parameter>\n</invoke>\n</function_calls>\n\nAfter outputting the function call, wait for the result.",
  "messages": [
    { "role": "user", "content": "Please add 5 and 3." }
  ]
}
```

### Buggy Response
```json
{
  "model": "claude-haiku-4-5-20251001",
  "id": "msg_01NYU6HhvMXSfDhQv582shGy",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll add 5 and 3 for you.\n<function_calls>\n<invoke name=\"add\">\n<parameter name=\"a\">5</parameter>\n<parameter name=\"b\">3</parameter>\n</invoke>\n</function_calls>\n\nPlease wait for the result..."
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 99,
    "output_tokens": 92
  }
}
```

Note that:
1. The output contains `</function_calls>` (the stop sequence)
2. The output continues with `"\n\nPlease wait for the result..."` AFTER the stop sequence
3. `stop_reason` is `"end_turn"` instead of `"stop_sequence"`
4. `stop_sequence` is `null` instead of `"</function_calls>"`

### Correct Response (same request, different run)
```json
{
  "model": "claude-haiku-4-5-20251001",
  "id": "msg_01KhwtLrg7agz5oUDVUn3o1w",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll add 5 and 3 for you.\n<function_calls>\n<invoke name=\"add\">\n<parameter name=\"a\">5</parameter>\n<parameter name=\"b\">3</parameter>\n</invoke>\n"
    }
  ],
  "stop_reason": "stop_sequence",
  "stop_sequence": "</function_calls>",
  "usage": {
    "input_tokens": 99,
    "output_tokens": 58
  }
}
```

## Test Results

Running 10 iterations with the reproduction script:

```
Run 1: OK - stop sequence triggered correctly
Run 2: BUG - stop sequence in output but stop_reason="end_turn"
Run 3: OK - stop sequence triggered correctly
Run 4: OK - stop sequence triggered correctly
Run 5: BUG - stop sequence in output but stop_reason="end_turn"
Run 6: OK - stop sequence triggered correctly
Run 7: OK - stop sequence triggered correctly
Run 8: OK - stop sequence triggered correctly
Run 9: OK - stop sequence triggered correctly
Run 10: OK - stop sequence triggered correctly

Summary:
Bug reproduced: 2/10
Working correctly: 8/10
```

## Environment

- Model: `claude-haiku-4-5-20251001`
- API Version: `2023-06-01`
- Date: January 2026

## Impact

This bug affects applications that rely on stop sequences for:
- XML-based tool calling (stopping at `</function_calls>`)
- Conversation management (stopping at participant markers like `\nUser:`)
- Any structured output parsing that depends on stop sequences

Workaround: Implement client-side stop sequence detection and truncation.
