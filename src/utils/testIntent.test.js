import test from 'node:test'
import assert from 'node:assert/strict'
import { extractTestIntent } from './testIntent.js'

test('extracts a Hinglish conceptual TCP/IP request without using the raw message as topic', () => {
  assert.deepEqual(
    extractTestIntent('TCP/IP model par 20 conceptual questions generate kro'),
    {
      action: 'generate_test',
      topic: 'TCP/IP Model',
      questionCount: 20,
      difficulty: 'mixed',
      questionType: 'conceptual',
    },
  )
})

test('extracts count and easy difficulty from informal Hinglish', () => {
  const intent = extractTestIntent('TCP IP ke 10 easy questions banao')
  assert.equal(intent.action, 'generate_test')
  assert.equal(intent.topic, 'TCP/IP Model')
  assert.equal(intent.questionCount, 10)
  assert.equal(intent.difficulty, 'easy')
})

test('extracts a mixed request with the topic after the question description', () => {
  assert.deepEqual(
    extractTestIntent('20 mixed easy medium hard questions on DNS'),
    {
      action: 'generate_test',
      topic: 'DNS',
      questionCount: 20,
      difficulty: 'mixed',
      questionType: 'multiple_choice',
    },
  )
})

test('handles common Hinglish spelling and filler words', () => {
  const intent = extractTestIntent('yes tcp ip model pr 20 mixed easy, medium and hard conceptual questions generate kro')
  assert.equal(intent.action, 'generate_test')
  assert.equal(intent.topic, 'TCP/IP Model')
  assert.equal(intent.questionCount, 20)
  assert.equal(intent.difficulty, 'mixed')
  assert.equal(intent.questionType, 'conceptual')
})

test('extracts mixed test intent from the reported TCP/IP phrase', () => {
  assert.deepEqual(
    extractTestIntent('TCP/IP Model par 20 mixed questions ka test create kro'),
    {
      action: 'generate_test',
      topic: 'TCP/IP Model',
      questionCount: 20,
      difficulty: 'mixed',
      questionType: 'multiple_choice',
    },
  )
})

test('extracts conceptual mixed intent from an informal confirmation', () => {
  assert.deepEqual(
    extractTestIntent('yes tcp ip model pr 20 mixed easy medium hard conceptual questions generate kro'),
    {
      action: 'generate_test',
      topic: 'TCP/IP Model',
      questionCount: 20,
      difficulty: 'mixed',
      questionType: 'conceptual',
    },
  )
})

test('keeps normal chat on the normal streaming path', () => {
  assert.deepEqual(extractTestIntent('Explain the TCP/IP model simply'), { action: 'none' })
})

test('asks for a topic rather than inventing one for an ambiguous request', () => {
  const intent = extractTestIntent('make 10 conceptual questions')
  assert.equal(intent.action, 'ambiguous')
  assert.match(intent.reason, /topic/i)
})
