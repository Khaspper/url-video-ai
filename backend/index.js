import express from 'express';
import uniqid from 'uniqid';
import fs from 'fs';
import cors from 'cors';
import { GPTScript, RunEventType } from '@gptscript-ai/gptscript';
import 'dotenv/config';

const app = express();
app.use(cors());

const g = new GPTScript({
  apiKey: process.env.OPENAI_API_KEY,
});

// List of Minecraft parkour video URLs and their durations in seconds
const videoUrls = [
  { url: "https://youtu.be/85z7jqGAGcc", duration: 7210 }, // Example duration
  { url: "https://youtu.be/i0M4ARe9v0Y", duration: 300 }, // Example duration
  // Add more videos here with their durations
];

// Function to generate a random time frame
function getRandomStartTime(videoDuration) {
  const maxStartTime = Math.max(0, videoDuration - 30); // Ensure 30 seconds left
  return Math.floor(Math.random() * maxStartTime); // Random start time
}

app.get('/test', (req, res) => {
  return res.json('test ok');
});

app.get('/create-story', async (req, res) => {
  const url = req.query.url;
  const dir = uniqid();
  const path = './stories/' + dir;
  fs.mkdirSync(path, { recursive: true });

  console.log({ url });

  try {
    // Select a single random video URL with a 30-second time frame
    const randomVideo = videoUrls[Math.floor(Math.random() * videoUrls.length)];
    const randomStartTime = getRandomStartTime(randomVideo.duration);
    const videoWithTime = `${randomVideo.url}?t=${randomStartTime}`;
    const videoPath = `${path}/video.txt`;

    // Save the video URL with timestamp
    fs.writeFileSync(videoPath, videoWithTime);
    console.log(`Saved the video URL to ${videoPath}`);

    // Pass the video URL to GPTScript
    const opts = {
      input: `--url ${url} --dir ${path} --apiKey ${process.env.OPENAI_API_KEY} --videoUrl ${videoWithTime}`,
      disableCache: true,
    };

    const run = await g.run('./story.gpt', opts);

    run.on(RunEventType.Event, (ev) => {
      if (ev.type === RunEventType.CallFinish && ev.output) {
        console.log(ev.output);
      }
    });

    // Generate the long story
    const storyPath = `${path}/story.txt`;
    const result = await run.text();
    fs.writeFileSync(storyPath, result); // Save the story text
    console.log(`Saved the story to ${storyPath}`);

    // Generate speech file using text2speech-gptscript
    const text2speechOpts = {
      text: result,  // Pass the generated story text
      voice: "en_us",  // Optional: set voice (you can change it to others like "en_uk", etc.)
      format: "mp3",  // Optional: set format to mp3
    };

    // Run the text2speech command to generate the MP3 file
    const speechPath = `${path}/voiceover.mp3`;
    await g.run('github.com/nw0rn/text2speech-gptscript', text2speechOpts);

    console.log(`Saved the speech to ${speechPath}`);

    // Return success response with paths to story and speech files
    return res.json({
      storyPath,
      videoPath,
      video: videoWithTime,
      speechPath,
    });
  } catch (e) {
    console.error(e);
    return res.json(e);
  }
});

app.listen(8080, () => console.log('Listening on port 8080'));
