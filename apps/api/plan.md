Goal
	•	Build/refresh a library.json index for all videos on the external HDD.
	•	Generate one poster image per video.

Environment
	•	Device: Raspberry Pi (Linux)
	•	Video root folder: /media/pi/ExternalHD/Cine
	•	Output folder (writable): /mnt/hdd/HomeVideoIndex
	•	Tools installed: ffprobe, ffmpeg, node (versions optional)

Folder conventions
	•	Movies live in: <root>/Movies/**
	•	Series live in: <root>/Series/<Show>/<Season>/**
	•	Accepted video extensions: .mp4, .mkv, .mov, .avi

What to generate
	•	library.json containing (per video):
	•	id (stable hash from full path)
	•	type (movie | episode | other)
	•	title (derived from filename/folders)
	•	path (relative path from root)
	•	durationSec
	•	video: codec, width, height, fps, bitrate
	•	audio: codec, channels, bitrate, language(if available)
	•	sizeBytes
	•	mtime (last modified timestamp)
	•	posterPath (relative path to generated poster)
	•	Posters:
	•	store in posters/<id>.jpg
	•	pick a frame at 10% of duration (fallback: 60s)
	•	size: 480px wide (keep aspect ratio)

Incremental update rules
	•	If file is new or mtime changed, re-index and re-generate poster.
	•	If unchanged, reuse cached metadata/poster.
	•	Remove entries for deleted files.

Constraints / Safety
	•	Read-only on video folders (never modify videos).
	•	Only write inside output folder.
	•	Must handle filenames with spaces and weird chars safely.
	•	Should not crash on a single bad file; log and continue.

Definition of done
	•	library.json is valid JSON and includes all discovered videos.
	•	Posters exist for indexed items (unless generation failed; then mark error).
	•	quality-report.md produced with warnings (missing keyframes, huge bitrate, VFR, etc.).

The “minimum context” if you want it super short

If you want to start ultra-light, the minimum is:
	•	root path to scan
	•	output path
	•	folder rules (Movies/Series)
	•	extension list
	•	write constraints

What an agent actually needs from you (concrete values)

For your Pi, I’d want these exact strings from you:
	•	The mounted drive path (common ones): /media/pi/<name> or /mnt/<name>
	•	Where you want the index stored (same drive or Pi SD card?)
	•	Your folder layout (do you already have Movies/Series?)

If you reply with your real paths (even just an example like /media/pi/WD4TB/Videos/Movies), I’ll turn that into a ready-to-run “agent instruction” + the exact commands (ffprobe/ffmpeg) and a clean library.json schema.
