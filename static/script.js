// ===============================
// GLOBAL STATE
// ===============================
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let isEditing = false;
let recordTimerInterval = null;
let recordSeconds = 0;

// ===============================
// DOM REFS
// ===============================
const recordBtn         = document.getElementById("recordBtn");
const recordTimer       = document.getElementById("recordTimer");
const timerDisplay      = document.getElementById("timerDisplay");
const fileInput         = document.getElementById("fileInput");
const uploadArea        = document.getElementById("uploadArea");
const audioPlayer       = document.getElementById("audioPlayer");
const transcribeBtn     = document.getElementById("transcribeBtn");
const output            = document.getElementById("transcriptionText");
const wordCount         = document.getElementById("wordCount");
const statusBadge       = document.getElementById("statusBadge");
const progressWrap      = document.getElementById("progressWrap");
const progressFill      = document.getElementById("progressFill");
const editBtn           = document.getElementById("editBtn");
const copyBtn           = document.getElementById("copyBtn");
const clearBtn          = document.getElementById("clearBtn");
const downloadPDF       = document.getElementById("downloadPDF");
const downloadTXT       = document.getElementById("downloadTXT");

// ===============================
// UTILITIES
// ===============================
function showStatus(msg, type = "info") {
    statusBadge.textContent = msg;
    statusBadge.className = `status-badge status-${type}`;
    statusBadge.classList.remove("hidden");
    if (type === "success") setTimeout(hideStatus, 3000);
}

function hideStatus() {
    statusBadge.classList.add("hidden");
}

function updateWordCount() {
    const text = output.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    wordCount.textContent = `${words} word${words !== 1 ? "s" : ""} · ${chars} character${chars !== 1 ? "s" : ""}`;
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

function setAudioSource(blob) {
    audioBlob = blob;
    const url = URL.createObjectURL(blob);
    audioPlayer.src = url;
    audioPlayer.load();
}

// ===============================
// 🎤 RECORD AUDIO
// ===============================
recordBtn.addEventListener("click", async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: "audio/webm" });
                setAudioSource(blob);
                stream.getTracks().forEach(t => t.stop());
                showStatus("Recording saved. Click Transcribe!", "success");
            };

            mediaRecorder.start(250); // collect in 250ms chunks
            recordBtn.textContent = "⏹ Stop Recording";
            recordBtn.classList.add("recording");
            showStatus("Recording…", "info");

            // Timer
            recordSeconds = 0;
            timerDisplay.textContent = "0:00";
            recordTimer.classList.remove("hidden");
            recordTimerInterval = setInterval(() => {
                recordSeconds++;
                timerDisplay.textContent = formatTime(recordSeconds);
            }, 1000);

        } catch (err) {
            showStatus("Microphone access denied. Please allow mic permissions.", "error");
        }
    } else if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        recordBtn.textContent = "🎙 Start Recording";
        recordBtn.classList.remove("recording");
        recordTimer.classList.add("hidden");
        clearInterval(recordTimerInterval);
    }
});

// ===============================
// 📁 UPLOAD — click
// ===============================
uploadArea.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleUpload(fileInput.files[0]);
});

// ===============================
// 📦 DRAG & DROP
// ===============================
uploadArea.addEventListener("dragover", e => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", e => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
});

function handleUpload(file) {
    const allowed = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a",
                     "audio/webm", "audio/ogg", "video/webm", "video/mp4"];
    // Also check by extension for browsers that mis-detect MIME
    const ext = file.name.split(".").pop().toLowerCase();
    const allowedExts = ["mp3", "wav", "m4a", "mp4", "webm", "ogg"];

    if (!allowed.includes(file.type) && !allowedExts.includes(ext)) {
        showStatus("Unsupported file type. Please upload MP3, WAV, M4A, MP4, WEBM, or OGG.", "error");
        return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 25) {
        showStatus(`File too large (${sizeMB.toFixed(1)} MB). Maximum is 25 MB.`, "error");
        return;
    }

    setAudioSource(file);
    showStatus(`"${file.name}" loaded (${sizeMB.toFixed(1)} MB). Ready to transcribe.`, "success");
}

// ===============================
// ✨ TRANSCRIBE
// ===============================
transcribeBtn.addEventListener("click", transcribeAudio);

async function transcribeAudio() {
    if (!audioBlob) {
        showStatus("Please record or upload audio first.", "error");
        return;
    }

    // Show progress
    output.value = "";
    updateWordCount();
    progressWrap.classList.remove("hidden");
    transcribeBtn.disabled = true;
    transcribeBtn.textContent = "⏳ Transcribing…";
    showStatus("Sending audio to Whisper…", "info");

    // Animate progress bar (fake — real progress not available from Whisper API)
    let pct = 0;
    const pctInterval = setInterval(() => {
        pct = Math.min(pct + Math.random() * 8, 90);
        progressFill.style.width = pct + "%";
    }, 400);

    const formData = new FormData();
    // Always name file with an extension so server can detect type
    const ext = audioBlob.type.includes("webm") ? "webm"
              : audioBlob.type.includes("mp4")  ? "mp4"
              : audioBlob.type.includes("ogg")  ? "ogg"
              : audioBlob.name ? audioBlob.name.split(".").pop()
              : "wav";
    formData.append("file", audioBlob, `audio.${ext}`);

    try {
        const res = await fetch("/transcribe", {
            method: "POST",
            body: formData
        });

        clearInterval(pctInterval);

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Unknown server error" }));
            throw new Error(err.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();
        progressFill.style.width = "100%";
        setTimeout(() => progressWrap.classList.add("hidden"), 600);

        output.value = data.text;
        updateWordCount();
        showStatus("Transcription complete!", "success");

    } catch (err) {
        clearInterval(pctInterval);
        progressWrap.classList.add("hidden");
        showStatus(`❌ ${err.message}`, "error");
        output.value = "";
    } finally {
        transcribeBtn.disabled = false;
        transcribeBtn.textContent = "✨ Transcribe Audio";
    }
}

// ===============================
// ✏️ EDIT BUTTON
// ===============================
editBtn.addEventListener("click", () => {
    isEditing = !isEditing;
    output.readOnly = !isEditing;

    if (isEditing) {
        editBtn.textContent = "✅ Done Editing";
        editBtn.classList.add("active");
        output.focus();
        showStatus("Editing enabled. Click 'Done Editing' when finished.", "info");
    } else {
        editBtn.textContent = "✏️ Edit";
        editBtn.classList.remove("active");
        updateWordCount();
        showStatus("Changes saved.", "success");
    }
});

output.addEventListener("input", updateWordCount);

// ===============================
// 📋 COPY BUTTON
// ===============================
copyBtn.addEventListener("click", async () => {
    const text = output.value.trim();
    if (!text) {
        showStatus("Nothing to copy yet.", "error");
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        showStatus("Copied to clipboard!", "success");
        copyBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyBtn.textContent = "📋 Copy"), 2000);
    } catch {
        // Fallback for browsers without clipboard API
        output.select();
        document.execCommand("copy");
        showStatus("Copied!", "success");
    }
});

// ===============================
// 🗑 CLEAR BUTTON
// ===============================
clearBtn.addEventListener("click", () => {
    if (!output.value) return;
    if (confirm("Clear the transcription text?")) {
        output.value = "";
        updateWordCount();
        // Also reset edit mode
        isEditing = false;
        output.readOnly = true;
        editBtn.textContent = "✏️ Edit";
        editBtn.classList.remove("active");
        showStatus("Cleared.", "info");
    }
});

// ===============================
// 📄 DOWNLOAD PDF
// ===============================
downloadPDF.addEventListener("click", () => {
    const text = output.value.trim();
    if (!text) {
        showStatus("No transcription to export.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 18;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("VocalScribe Transcription", margin, margin);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleString(), margin, margin + 22);
    doc.setTextColor(0);

    doc.setLineWidth(0.5);
    doc.line(margin, margin + 32, pageWidth - margin, margin + 32);

    // Body
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, maxWidth);
    let y = margin + 52;

    lines.forEach(line => {
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
    });

    doc.save("vocalscribe-transcript.pdf");
    showStatus("PDF downloaded!", "success");
});

// ===============================
// 📝 DOWNLOAD TXT
// ===============================
downloadTXT.addEventListener("click", () => {
    const text = output.value.trim();
    if (!text) {
        showStatus("No transcription to export.", "error");
        return;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocalscribe-transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
    showStatus("TXT downloaded!", "success");
});
