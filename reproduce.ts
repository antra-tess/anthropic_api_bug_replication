/**
 * Anthropic API Stop Sequence Bug Reproduction
 *
 * Run with: ANTHROPIC_API_KEY=your_key npx tsx reproduce.ts
 */

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Please set ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const STOP_SEQUENCE = '</function_calls>';

const requestBody = {
  model: MODEL,
  max_tokens: 500,
  stop_sequences: [STOP_SEQUENCE],
  system: `You have access to a tool called "add". When asked to add numbers, you MUST output:
<function_calls>
<invoke name="add">
<parameter name="a">first_number</parameter>
<parameter name="b">second_number</parameter>
</invoke>
</function_calls>

After outputting the function call, wait for the result.`,
  messages: [
    { role: 'user', content: 'Please add 5 and 3.' },
  ],
};

console.log('=== Anthropic Stop Sequence Bug Reproduction ===\n');
console.log('Model:', MODEL);
console.log('Stop sequence:', JSON.stringify(STOP_SEQUENCE));
console.log('Running 10 iterations to catch intermittent bug...\n');

let bugCount = 0;
let successCount = 0;
let noOutputCount = 0;

for (let i = 1; i <= 10; i++) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const containsStopSeq = text.includes(STOP_SEQUENCE);
  const textAfterStopSeq = containsStopSeq
    ? text.slice(text.indexOf(STOP_SEQUENCE) + STOP_SEQUENCE.length)
    : '';

  if (containsStopSeq && data.stop_reason !== 'stop_sequence') {
    bugCount++;
    console.log(`Run ${i}: BUG - stop sequence in output but stop_reason="${data.stop_reason}"`);
    console.log(`  Text after stop sequence: ${JSON.stringify(textAfterStopSeq)}`);
    console.log(`  Full response: ${JSON.stringify(data, null, 2)}`);
  } else if (data.stop_reason === 'stop_sequence') {
    successCount++;
    console.log(`Run ${i}: OK - stop sequence triggered correctly`);
  } else {
    noOutputCount++;
    console.log(`Run ${i}: Model did not output stop sequence`);
  }
}

console.log('\n=== Summary ===');
console.log(`Bug reproduced: ${bugCount}/10`);
console.log(`Working correctly: ${successCount}/10`);
console.log(`No stop sequence output: ${noOutputCount}/10`);

if (bugCount > 0) {
  console.log('\nBUG CONFIRMED: Stop sequence intermittently fails to trigger.');
}
