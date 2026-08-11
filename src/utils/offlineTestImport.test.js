import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_TEST_SCHEMA, parseOfflineTestJson } from './offlineTestImport.js'

const validPayload = {
  schema: OFFLINE_TEST_SCHEMA,
  title: 'TCP/IP Practice Test',
  topic: 'TCP/IP Model',
  difficulty: 'mixed',
  config: {
    timingMode: 'total',
    timeLimit: 15,
  },
  questions: [
    {
      questionNumber: 1,
      question: 'Which TCP/IP layer is responsible for end-to-end communication?',
      options: {
        A: 'Application',
        B: 'Transport',
        C: 'Internet',
        D: 'Network Access',
      },
      correctAnswer: 'B',
      explanation: 'Transport layer provides end-to-end communication.',
      difficulty: 'medium',
    },
  ],
}

test('parses valid offline test JSON into a LearnLedger test object', () => {
  const parsed = parseOfflineTestJson(JSON.stringify(validPayload))

  assert.equal(parsed.topic, 'TCP/IP Model')
  assert.equal(parsed.title, 'TCP/IP Practice Test')
  assert.equal(parsed.status, 'in-progress')
  assert.equal(parsed.config.scope, 'offline-import')
  assert.equal(parsed.config.parsingMode, 'manual')
  assert.equal(parsed.config.questionCount, 1)
  assert.equal(parsed.questions[0].questionNumber, 1)
  assert.deepEqual(parsed.questions[0].options.map((option) => option.id), ['a', 'b', 'c', 'd'])
  assert.equal(parsed.questions[0].correctAnswer, 'b')
})

test('reports the exact question and option when validation fails', () => {
  const invalidPayload = structuredClone(validPayload)
  delete invalidPayload.questions[0].options.C

  assert.throws(
    () => parseOfflineTestJson(JSON.stringify(invalidPayload)),
    /Question 1 option C is required/,
  )
})
