const express = require("express");
const play = require("play-dl");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// 📁 Setup
const MUSIC_DIR = path.join(__dirname, "music");
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR);

// 🍪 Load cookies
if (fs.existsSync("./cookies.json")) {
    play.setToken({
        youtube: {
            cookies: fs.readFileSync("./cookies.json").toString()
        }
    });
}

// 🔥 Cache (videoId → file URL)
const cache = new Map();

// 🔥 Rate limit (IP based)
const userCooldown = new Map();
const COOLDOWN = 5000; // 5 sec

// 🔥 Queue
let processing = false;
const queue = [];

/* 🎵 DOWNLOAD */
app.get("/download", async (req, res) => {
    const url = req.query.url;
    const ip = req.ip;

    if (!url) return res.json({ success: false, message: "No URL" });

    // ⛔ Rate limit
    if (userCooldown.has(ip)) {
        const last = userCooldown.get(ip);
        if (Date.now() - last < COOLDOWN) {
            return res.json({ success: false, message: "Slow down" });
        }
    }
    userCooldown.set(ip, Date.now());

    try {
        const info = await play.video_info(url);
        const videoId = info.video_details.id;

        // ✅ CACHE HIT
        if (cache.has(videoId)) {
            return res.json({
                success: true,
                audio: cache.get(videoId),
                cached: true
            });
        }

        // 📦 Queue request
        queue.push({ url, res, videoId });
        processQueue();

    } catch (err) {
        res.json({ success: false, message: "Invalid URL" });
    }
});

/* 🔥 PROCESS QUEUE */
async function processQueue() {
    if (processing || queue.length === 0) return;

    processing = true;

    const { url, res, videoId } = queue.shift();
    const filePath = path.join(MUSIC_DIR, videoId + ".mp3");

    try {
        const stream = await play.stream(url);

        ffmpeg(stream.stream)
            .audioBitrate(128)
            .save(filePath)
            .on("end", () => {
                const fileUrl = `/music/${videoId}.mp3`;

                // ✅ Save cache
                cache.set(videoId, fileUrl);

                res.json({
                    success: true,
                    audio: fileUrl,
                    cached: false
                });

                processing = false;
                processQueue();
            });

    } catch (err) {
        res.json({ success: false, message: "Download failed" });
        processing = false;
        processQueue();
    }
}

/* 📁 Serve music */
app.use("/music", express.static(MUSIC_DIR));

/* 🧹 Cleanup old files */
setInterval(() => {
    fs.readdirSync(MUSIC_DIR).forEach(file => {
        const filePath = path.join(MUSIC_DIR, file);
        const age = Date.now() - fs.statSync(filePath).mtimeMs;

        if (age > 1000 * 60 * 30) { // 30 min
            fs.unlinkSync(filePath);
        }
    });
}, 300000);

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
