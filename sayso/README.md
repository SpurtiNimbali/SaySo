# SaySo – Adobe Express Add-on

SaySo is an Adobe Express add-on that transforms spoken design feedback into actionable tasks, streamlining creative collaboration.

## Features

- Record or upload audio feedback
- Fast, accurate transcription (OpenAI Whisper)
- Actionable task extraction (OpenAI GPT)
- Minimalist, accessible UI (React Spectrum)
- No persistent user data

## Directory Structure

```
/backend         # FastAPI backend (transcription, task extraction)
  app.py
  requirements.txt
/src
  /sandbox       # Document API sandbox logic
  /ui            # React UI (App.jsx, components)
    /components
  index.html
  manifest.json
.babelrc
.gitignore
package.json
package-lock.json
tsconfig.json
webpack.config.js
README.md
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- Python 3.8+
- OpenAI API key

### Frontend

```bash
cd sayso
npm install
npm run build
# For local dev:
npm run start
```

### Backend

```bash
cd sayso/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Set your OpenAI API key in a .env file:
echo "OPENAI_API_KEY=sk-..." > .env
uvicorn app:app --reload
```

## Usage

1. Launch Adobe Express and load the SaySo add-on.
2. Record or upload audio feedback.
3. View the transcript and actionable tasks.

## Development

- UI: React + React Spectrum
- Backend: FastAPI, OpenAI Whisper, GPT
- Build: Webpack

## Contributing

Pull requests welcome! Please open an issue first to discuss major changes.

## License

MIT
