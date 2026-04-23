const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const MUSIC_DIR = path.join(__dirname, "public", "music");
const COOKIE_FILE = path.join(__dirname, "cookies.txt");

// Ensure music directory exists
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

/* 🎵 CONVERT & DOWNLOAD API */
app.get("/download", (req, res) => {
    let url = req.query.url;
    if (!url) return res.status(400).json({ error: "No YouTube URL provided" });

    // Clean up shorts URLs
    url = url.replace("shorts/", "watch?v=");

    const videoId = Date.now().toString(); // Use timestamp to prevent overwrite collisions
    const outputPath = path.join(MUSIC_DIR, `${videoId}.mp3`);

    // yt-dlp arguments with anti-detection and cookie support
    const ytDlpArgs = [
        `yt-dlp`,
        `--extract-audio`,
        `--audio-format mp3`,
        `--audio-quality 0`, // Best quality
        `--cookies "${COOKIE_FILE}"`, // Pass your YouTube cookies
        `--geo-bypass`, // Help bypass region locks
        `--no-playlist`,
        `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"`, // Spoof standard browser
        `-o "${outputPath}"`,
        `"${url}"`
    ].join(" ");

    console.log(`Starting download for: ${url}`);

    exec(ytDlpArgs, (error, stdout, stderr) => {
        if (error) {
            console.error("YT-DLP ERROR:", stderr);
            return res.status(500).json({ error: "Failed to process video. It might be blocked or require a captcha update." });
        }

        res.json({
            success: true,
            audio_url: `/music/${videoId}.mp3`
        });
    });
});

/* 📁 SERVE STATIC FILES */
app.use("/music", express.static(MUSIC_DIR));

/* 🧹 AUTO CLEANUP (Every 30 minutes) */
setInterval(() => {
    try {
        const files = fs.readdirSync(MUSIC_DIR);
        const now = Date.now();

        files.forEach(file => {
            const filePath = path.join(MUSIC_DIR, file);
            const stats = fs.statSync(filePath);
            
            // Delete if file is older than 30 minutes (1800000 ms)
            if (now - stats.mtimeMs > 1800000) {
                fs.unlinkSync(filePath);
                console.log(`Auto-deleted old file: ${file}`);
            }
        });
    } catch (err) {
        console.error("Cleanup error:", err);
    }
}, 30 * 60 * 1000); 

/* 🚀 START SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Checking for cookies.txt: ${fs.existsSync(COOKIE_FILE) ? "Found!" : "MISSING!"}`);
});
