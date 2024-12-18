import express from 'express';
import uniqid from 'uniqid';
import fs from 'fs';
import cors from 'cors';
import { GPTScript, RunEventType } from '@gptscript-ai/gptscript';
import 'dotenv/config';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
app.use(cors());
app.use(express.static('stories'))

const g = new GPTScript({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate a random time frame
function getRandomStartTime(videoDuration) {
  const maxStartTime = Math.max(0, videoDuration - 30); // Ensure at least 30 seconds left
  return Math.floor(Math.random() * maxStartTime);
}

app.get('/test', (req, res) => {
  return res.json('test ok');
});

app.get('/create-story', async (req, res) => {
  const url = decodeURIComponent(req.query.url);
  const dir = uniqid();
  const path = './stories/' + dir;
  fs.mkdirSync(path, { recursive: true });

  console.log({ url });

  try {
    // Pass options to GPTScript
    const opts = {
      input: `--url ${url} --dir ${path} --apiKey ${process.env.OPENAI_API_KEY}`,
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

    // Generate speech file using hypothetical OpenAI TTS endpoint
    const speechPath = `${path}/voiceover.mp3`;
    const response = await openai.audio.speech.create({
      model: "tts-1",         // Hypothetical model name
      voice: "echo",          // Hypothetical voice name
      input: result,          // Use the story text
      response_format: "mp3", // Desired output format
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(speechPath, buffer);
    console.log(`Saved the speech to ${speechPath}`);

    // Transcribe the audio using OpenAI Whisper API
    const simplifiedTranscriptionPath = `${path}/simplified_transcription.json`; // Save simplified transcription
    try {
      // Get the duration of the audio file using ffmpeg
      const audioDuration = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(speechPath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata.format.duration); // Get the duration in seconds
        });
      });

      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: fs.createReadStream(speechPath), // Pass the audio file as a stream
        model: "whisper-1",                   // Specify the Whisper model
        response_format: "verbose_json",      // Ensure detailed word-level timestamps
      });

      // Simplify transcription response to include only words with their start and end times
      const simplifiedTranscription = {
        duration: audioDuration, // Add total audio duration
        words: [],
      };

      transcriptionResponse.segments.forEach((segment) => {
        segment.text.split(' ').forEach((word, index) => {
          const wordStart = segment.start + ((segment.end - segment.start) / segment.text.split(' ').length) * index;
          const wordEnd = wordStart + ((segment.end - segment.start) / segment.text.split(' ').length);
          simplifiedTranscription.words.push({ word: word.trim(), start: wordStart, end: wordEnd });
        });
      });

      // Save the simplified transcription
      fs.writeFileSync(simplifiedTranscriptionPath, JSON.stringify(simplifiedTranscription, null, 2));
      console.log(`Saved the simplified transcription to ${simplifiedTranscriptionPath}`);
    } catch (transcriptionError) {
      console.error("Error transcribing audio:", transcriptionError);
    }

    // Return success response with paths to story, speech, and transcription files
    return res.json(dir);
  } catch (e) {
    console.error(e);
    return res.json(e);
  }
});

app.get('/build-video', async (req, res) => {
  // const id = '1ckuquhmkm4gm7cb8';
  const id = req.query.id;
  const dir = './stories/' + id;
  const videoDir = './videos/';

  const inputVideo = path.join(videoDir, 'minecraft_parkour.mp4');
  const inputAudio = path.join(dir, 'voiceover.mp3');
  const inputTranscription = path.join(dir, 'simplified_transcription.json');
  const outputVideoPath = path.join(dir, 'output.mp4');

  // Read transcription file and parse it
  const transcription = JSON.parse(fs.readFileSync(inputTranscription, 'utf8'));
  const words = transcription.words;
  const duration = transcription.duration;

  // Generate a random start time for the video
  const videoDuration = duration;
  const maxStartTime = Math.max(0, videoDuration - duration);
  const startTime = Math.floor(Math.random() * maxStartTime);

  console.log(`Processing video from ${startTime}s for ${duration}s with synchronized captions...`);

  await new Promise((resolve, reject) => {
    // Build a new drawtext filter for synchronized captions
    let syncDrawtextFilter = words.map((wordInfo) => {
      const word = wordInfo.word.replace(/'/g, "\\'").replace(/\"/g, '\\"');
      const start = parseFloat(wordInfo.start).toFixed(2);
      const end = parseFloat(wordInfo.end).toFixed(2);
      return `drawtext=text='${word}':fontcolor=white:fontsize=96:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h*3/4)-text_h:enable='between(t\\,${start}\\,${end})'`;
    }).join(',');

    ffmpeg(inputVideo)
      .setStartTime(startTime) // Start time for the video
      .setDuration(videoDuration)  // Clip the video to match the videoDuration
      .input(inputAudio)          // Add the audio file as input
      .audioCodec('aac')          // Ensure audio codec is set to AAC
      .outputOptions([
        '-pix_fmt', 'yuv420p', // Set pixel format for compatibility
        '-map', '0:v:0',       // Map the video stream
        '-map', '1:a:0',       // Map the audio stream
        `-vf`, syncDrawtextFilter  // Add the synchronized drawtext filter for captions
      ])
      .on('start', (cmd) => {
        console.log(`FFmpeg process started with command: ${cmd}`);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log(`Video processing completed. Output file saved to ${outputVideoPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error during video processing: ${err.message}`);
        reject(err);
      })
      .save(outputVideoPath); // Save the output video
  });

  // Send success response
  res.json({
    message: 'Video processing completed successfully.',
    outputVideoPath,
  });
});

// app.get('/build-video', async (req, res) => {
//   const id = '1ckuqujgcm4frf9w3';
//   // const id = req.query.id;

//   if (!id) {
//     res.json('Error!! Missing ID')
//   }
//   const dir = './stories/' + id;
//   const videoDir = './stories/videos/';

//   // console.log(`Im in here`)
//   // console.log(`ID: ${id}`)
//   // console.log(`dir: ${dir}`)

//   const inputVideo = path.join(videoDir, 'minecraft_parkour.mp4');
//   const inputAudio = path.join(dir, 'voiceover.mp3');
//   const inputTranscription = path.join(dir, 'simplified_transcription.json');
//   const outputVideoPath = path.join(dir, 'output.mp4');

//   // Read transcription file and parse it
//   const transcription = JSON.parse(fs.readFileSync(inputTranscription, 'utf8'));
//   const words = transcription.words;
//   const duration = parseFloat(transcription.duration).toFixed(2);

//   // Generate a random start time for the video
//   const videoDuration = duration;
//   const maxStartTime = Math.max(0, videoDuration - duration);
//   const startTime = Math.floor(Math.random() * maxStartTime);

//   // Build the drawtext filter string
//   let drawtextFilter = '';
//   words.forEach((wordInfo) => {
//     const word = wordInfo.word.replace(/'/g, "\\'").replace(/"/g, '\\"');
//     const start = parseFloat(wordInfo.start).toFixed(2);
//     const end = parseFloat(wordInfo.end).toFixed(2);
//     drawtextFilter += `drawtext=text='${word}':fontcolor=white:fontsize=96:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h*3/4)-text_h:enable='between(t\\,${start}\\,${end})',`;
//   });
//   drawtextFilter = drawtextFilter.slice(0, -1); // Remove trailing comma

//   console.log(`Processing video from ${startTime}s for ${duration}s with text overlay...`);

//   await new Promise((resolve, reject) => {
//     ffmpeg(inputVideo)
//       .setStartTime(startTime) // Start time for the video
//       .setDuration(videoDuration)  // Clip the video to match the videoDuration
//       .input(inputAudio)          // Add the audio file as input
//       .audioCodec('aac')          // Ensure audio codec is set to AAC
//       .outputOptions([
//         '-pix_fmt', 'yuv420p', // Set pixel format for compatibility
//         '-map', '0:v:0',       // Map the video stream
//         '-map', '1:a:0',       // Map the audio stream
//       ])
//       .on('start', (cmd) => {
//         console.log(`FFmpeg process started with command: ${cmd}`);
//       })
//       .on('progress', (progress) => {
//         console.log(`Processing: ${progress.percent}% done`);
//       })
//       .on('end', () => {
//         console.log(`Video processing completed. Output file saved to ${outputVideoPath}`);
//         resolve();
//       })
//       .on('error', (err) => {
//         console.error(`Error during video processing: ${err.message}`);
//         reject(err);
//       })
//       .save(outputVideoPath); // Save the output video
//   });

//   // Send success response
//   res.json(dir);
  
// });

app.listen(8080, () => console.log('Listening on port 8080'));

//! FIX TEXT OVERLAY!!!!!!!!!!!!!!!!!!!!!!
