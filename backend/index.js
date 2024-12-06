import express from 'express';
import uniqid from 'uniqid';
import fs from 'fs';
import cors from 'cors';
import {GPTScript, RunEventType} from "@gptscript-ai/gptscript";
import { ok } from 'assert';


const app = express();
app.use(cors())

const g = new GPTScript({
  apiKey: 'your-openai-api-key-here', // Replace with your actual API key
});

app.get('/test', (req, res) => {
  return res.json('test ok');
});

app.get('/create-story', async (req, res) => {
  const url = req.query.url;
  const dir = uniqid();
  const path = './stories/' + dir;
  fs.mkdirSync(path, {recursive: true});

  console.log({
    url,
  });

  const opts = {
    input: `--url ${url} --dir ${dir}`,
    disableCache: true,
  };
  try {
    console.log('About to run story gpt')
    const run = await g.run('./story.gpt', opts);
    console.log("awaiting results")
    run.on(RunEventType.Event, ev => {
      if(ev.type === RunEventType.CallFinish && ev.output) {
        console.log(ev.output)
      }
    });
    const result = await run.text();
  
    return res.json(result);
  } catch(e) {
    console.error(e);
    return res.json(e);
  }
  
  // return res.json('ok');
});

app.listen(8080, () => console.log('Listening on port 8080'))


//! ADD YOUR API KEY