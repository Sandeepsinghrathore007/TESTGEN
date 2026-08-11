const fs = require('fs');

try {
  const logPath = 'C:/Users/Sandeep Rathore/.gemini/antigravity/brain/2dd95c75-1706-4868-9b52-8d22eed576ed/.system_generated/logs/transcript_full.jsonl';
  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  let latestCode = null;

  for (const line of lines) {
    if (line.includes('write_to_file') && line.includes('AIPage.jsx') && line.includes('tool_calls')) {
      const data = JSON.parse(line);
      const toolCalls = data.tool_calls || [];
      for (const tc of toolCalls) {
        if (tc.name === 'default_api:write_to_file' && tc.arguments.TargetFile.includes('AIPage.jsx')) {
          latestCode = tc.arguments.CodeContent;
        }
      }
    }
  }

  if (latestCode) {
    fs.writeFileSync('src/pages/AIPage.jsx', latestCode, 'utf8');
    console.log('Successfully restored AIPage.jsx from transcript logs!');
  } else {
    console.log('No matching tool call found in transcript logs.');
  }
} catch (e) {
  console.error(e);
}
