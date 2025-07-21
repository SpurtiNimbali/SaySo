from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import whisper
import tempfile
import os
import openai
from fastapi import Body
from dotenv import load_dotenv

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise RuntimeError("OPENAI_API_KEY environment variable not set. Please add it to your .env file.")
client = openai.OpenAI(api_key=openai_api_key)
print("DEBUG: OpenAI client initialized with API key.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = whisper.load_model("small")


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file:
        return JSONResponse(status_code=400, content={"error": "No file uploaded"})
    filename = file.filename or "audio.webm"
    suffix = os.path.splitext(filename)[-1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        result = model.transcribe(tmp_path, language="en")
        transcript = result.get('text', '')
        segments = result.get('segments', [])
        # Each segment has 'start', 'end', 'text'.
        transcript_segments = [
            {
                'start': seg.get('start'),
                'end': seg.get('end'),
                'text': seg.get('text')
            }
            for seg in segments if isinstance(seg, dict)
        ]
    except Exception as e:
        os.remove(tmp_path)
        return JSONResponse(status_code=500, content={"error": f"Transcription failed: {str(e)}"})
    os.remove(tmp_path)
    return {"transcript": transcript, "segments": transcript_segments}

@app.post("/generate-tasks")
async def generate_tasks(
    transcript_segments: list = Body(...),
    selection_history: list = Body(...)
):
    # Build a mapping of transcript segment to relevant elements
    correlated_context = []
    for seg in transcript_segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        seg_text = seg.get("text", "")
        # Find all elements selected during this segment
        elements = [
            el for el in selection_history
            if "timestamp" in el and seg_start <= el["timestamp"] <= seg_end
        ]
        correlated_context.append({
            "transcript": seg_text,
            "start": seg_start,
            "end": seg_end,
            "elements": elements
        })

    # Build a readable string for the LLM
    context_str = ""
    for ctx in correlated_context:
        context_str += (
            f"Transcript [{ctx['start']}s - {ctx['end']}s]: {ctx['transcript']}\n"
            f"Elements selected during this segment:\n"
        )
        for el in ctx["elements"]:
            context_str += (
                f"  ID: {el.get('elementId')}, Type: {el.get('elementType')}, "
                f"Text: {el.get('text')}, Name: {el.get('name')}, "
                f"Position: ({el.get('x')}, {el.get('y')}), "
                f"Size: ({el.get('width')}x{el.get('height')}), "
                f"Timestamp: {el.get('timestamp')}\n"
            )
        context_str += "\n"
    prompt = (
        "You are a design critique assistant for Adobe Express.\n"
        "Given transcript segments and selected elements (with id, type, name, text, position, size), generate a JSON array of design feedback tasks.\n"
        "\n"
        "Rules:\n"
        "- Group by element. Merge all feedback into one task per element.\n"
        "- One task = one element. No duplicates. Combine instructions with 'also', etc.\n"
        "- For text: quote first 4–6 words only (followed by ELLIPSIS)\n"
        "- For non-text: refer to type + position. PLEASE MENTION POSITION AND ELEMENT TYPE IN HUMAN LANGUAGE. NO COORDINATES. Use name if available.\n"
        "- Use only user-facing types (text, image, shape, etc).\n"
        "- Set 'person' if named in the same segment. Else null.\n"
        "- Skip vague references. No transcript quotes.\n"
        "- Output must be a **valid JSON array only**.\n"
        "\n"
        "Each task:\n"
        "{ 'title', 'description', 'elementId', 'elementType', 'elementPosition', 'elementSize', 'person' }\n"
        "\n"
        "Example:\n"
        "[{\n"
        "  \"title\": \"Refine Heading Style\",\n"
        "  \"description\": \"The text 'Ankit Sharma' should be larger, bolder, and its typography updated.\",\n"
        "  \"elementId\": \"txt001\",\n"
        "  \"elementType\": \"text\",\n"
        "  \"elementPosition\": { \"x\": 120, \"y\": 80 },\n"
        "  \"elementSize\": { \"width\": 300, \"height\": 60 },\n"
        "  \"person\": null\n"
        "}]\n"
        "\n"
        f"Context:\n{context_str}\n"
        "Respond ONLY with a valid JSON array as described above. If no tasks can be generated, respond with an empty JSON array: []."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.4,
        )
        # Try to extract JSON from the response
        import json
        import re
        content = response.choices[0].message.content or ""
        print("LLM raw output:", content)
        match = re.search(r'\[.*\]', content, re.DOTALL)
        tasks = []
        if match:
            json_str = match.group(0)
            print("Extracted JSON string:", json_str)
            try:
                tasks = json.loads(json_str)
            except json.JSONDecodeError:
                try:
                    fixed_json_str = json_str.replace("'", '"')
                    tasks = json.loads(fixed_json_str)
                except Exception as e:
                    print("JSON parse error after fix:", e)
                    tasks = []
        else:
            print("No JSON array found in LLM output.")
            tasks = []
        return {"tasks": tasks, "raw": content}
    except Exception as e:
        import traceback
        print("Task generation error:", e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Task generation failed: {str(e)}"}) 