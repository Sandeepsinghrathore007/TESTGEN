export const OFFLINE_TEST_GENERATION_PROMPT = `Generate the output strictly in this LearnLedger JSON format so it can be imported without errors.

Provide the entire JSON inside a single \`\`\`json \`\`\` markdown code block so it can be copied with one click. Do NOT include any conversational text or explanations outside the code block.

Schema and Structure:
\`\`\`json
{
  "schema": "learnledger-offline-test/v1",
  "title": "<Test Title>",
  "topic": "<Topic Name>",
  "difficulty": "easy | medium | hard | mixed",
  "language": "english | hindi",
  "config": {
    "timingMode": "total",
    "timeLimit": 15
  },
  "questions": [
    {
      "questionNumber": 1,
      "question": "<Question Text>",
      "options": {
        "A": "<Option A>",
        "B": "<Option B>",
        "C": "<Option C>",
        "D": "<Option D>"
      },
      "correctAnswer": "A",
      "explanation": "<Detailed Explanation>",
      "difficulty": "easy | medium | hard",
      "subjectName": "<Subject Name or empty string>",
      "topicName": "<Topic Name or empty string>"
    }
  ]
}
\`\`\`

Format Rules:
1. Wrap the entire response in a single \`\`\`json ... \`\`\` code block.
2. "schema" must be exactly "learnledger-offline-test/v1".
3. "questionNumber" must start at 1 and increment sequentially (1, 2, 3...).
4. Every question must have exactly 4 options with keys: "A", "B", "C", "D" (non-empty strings).
5. "correctAnswer" must be strictly one of: "A", "B", "C", or "D".
6. Every question must have a non-empty "explanation".
7. "difficulty" at the root level must be "easy", "medium", "hard", or "mixed".
8. Question level "difficulty" must be "easy", "medium", or "hard".
9. Timing config options:
   - Total time: {"timingMode": "total", "timeLimit": <minutes>}
   - Per question: {"timingMode": "per-question", "timePerQuestion": <seconds>}
10. Do not write any conversational text before or after the code block.`
