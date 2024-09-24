import json
from youtube_transcript_api import YouTubeTranscriptApi

video_id = 'jANxd6YGdAA'  # replace with your YouTube video ID

try:
    transcript = YouTubeTranscriptApi.get_transcript(video_id)
    json_output = json.dumps(transcript)  # Convert to JSON formatted string
    print(json_output)
except Exception as e:
    print("Failed to retrieve or convert transcript:", str(e))
