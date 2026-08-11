const fs = require('fs');
const path = 'C:/Users/Sandeep Rathore/.gemini/antigravity/brain/2dd95c75-1706-4868-9b52-8d22eed576ed/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
lines.forEach(l => {
  if (l.includes('"step_index":861')) {
    const d = JSON.parse(l);
    console.log(d.content);
  }
});
