import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi

if len(sys.argv) != 2:
    print("Usage: python youtube.py <video_id>")
    sys.exit(1)

video_id = sys.argv[1]  # Get video ID from command-line arguments

try:
    transcript = YouTubeTranscriptApi.get_transcript(video_id)
    json_output = json.dumps(transcript)  # Convert to JSON formatted string
    print(json_output)
except Exception as e:
    print("Failed to retrieve or convert transcript:", str(e))