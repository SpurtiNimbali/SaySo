import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Button,
  ButtonGroup,
  Text,
  DialogTrigger,
  AlertDialog,
  FileTrigger,
  Heading,
  ProgressCircle,
  Header,
  Content,
  ActionButton,
  Flex,
  Divider as SpectrumDivider,
  Pressable,
} from "@adobe/react-spectrum";

import CloseIcon from '@spectrum-icons/workflow/Close';
// Remove useHover import

export default function TranscriptUploader({ addOnUISdk, sandboxProxy }) {
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [showError, setShowError] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
  const [contextSummary, setContextSummary] = useState(null);
  const [selectionHistory, setSelectionHistory] = useState([]);
  const recordingStartTimeRef = useRef(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const selectionIntervalRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  // Add state to track the currently selected overlay element
  // const [overlayElement, setOverlayElement] = useState(null); // Removed

  const designQuotes = [
    "Design is intelligence made visible. – Alina Wheeler",
    "Good design is obvious. Great design is transparent. – Joe Sparano",
    "Simplicity is the ultimate sophistication. – Leonardo da Vinci",
    "Design adds value faster than it adds costs. – Joel Spolsky",
    "Styles come and go. Good design is a language, not a style. – Massimo Vignelli"
  ];
  const [quote, setQuote] = useState(designQuotes[0]);
  useEffect(() => {
    if (tasksLoading) {
      setQuote(designQuotes[Math.floor(Math.random() * designQuotes.length)]);
    }
  }, [tasksLoading]);

  // Handle audio recording
  const startRecording = async () => {
    setError("");
    setTranscript("");
    setAudioBlob(null);
    setSelectionHistory([]); // Reset selection history for new recording
    // Set the ref immediately for accurate timing
    recordingStartTimeRef.current = Date.now();
    setRecordingStartTime(recordingStartTimeRef.current); // for UI if needed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        console.log("Recorded audioBlob:", blob, "size:", blob.size);
        // Call handleUpload after setting the blob
        setTimeout(() => {
          handleUpload(blob);
        }, 100); // Small delay to ensure state is updated
      };
      mediaRecorder.start();
      setRecording(true);
      // Start polling for selection every 3 seconds
      selectionIntervalRef.current = setInterval(async () => {
        if (!sandboxProxy?.getCurrentSelection) return;
        try {
          const selected = await sandboxProxy.getCurrentSelection();
          const now = Date.now();
          const secondsSinceStart = (now - recordingStartTimeRef.current) / 1000;

          setSelectionHistory(prev => [
            ...prev,
            ...selected.map(node => ({
              timestamp: Number(secondsSinceStart.toFixed(2)),
              elementId: node.id,
              elementType: node.type,
              content: node.type && node.type.toLowerCase() === "text" ? node.text || "" : "",
              width: node.width,
              height: node.height,
              x: node.x,
              y: node.y,
              rotation: node.rotation,
              opacity: node.opacity,
              blendMode: node.blendMode,
              name: node.name,
              text: node.text
            }))
          ]);
        } catch (err) {
          // error handling
        }
      }, 3000);
    } catch (err) {
      setError("Microphone access denied or not supported.");
      setShowError(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
    // Stop polling for selection
    if (selectionIntervalRef.current) {
      clearInterval(selectionIntervalRef.current);
      selectionIntervalRef.current = null;
    }
    recordingStartTimeRef.current = null;
  };

  // Upload to backend
  const handleUpload = async (blob = audioBlob) => {
    setLoading(true);
    setError("");
    setTranscript("");
    setTranscriptSegments([]);
    const formData = new FormData();

    if (blob) {
      formData.append("file", blob, "recording.webm");
      console.log("[DEBUG] audioBlob before upload:", blob);
    } else {
      setError("No audio recorded.");
      setShowError(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Transcription failed");
      const data = await response.json();
      console.log("[DEBUG] /transcribe response:", data);
      setTranscript(data.transcript);
      setTranscriptSegments(data.segments || []);
      console.log("[DEBUG] transcriptSegments after set:", data.segments || []);
    } catch (err) {
      setError(err.message || "Error uploading file");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function extractDocumentContext() {
    if (!window.addOnUISdk && !addOnUISdk) {
      setError("addOnUISdk not available");
      setShowError(true);
      return;
    }
    const sdk = window.addOnUISdk || addOnUISdk;
    try {
      // Always use PNG for preview; you can add logic for video if needed
      const format = sdk.constants.RenditionFormat.png;
      const formatLabel = "png";
      const type = "image";
      const rendition = await sdk.app.document.createRenditions(
        {
          range: sdk.constants.Range.currentPage,
          format,
        },
        sdk.constants.RenditionIntent.preview
      );
      const blob = rendition[0].blob;
      const base64 = await blobToBase64(blob);
      setContextSummary({
        type,
        format: formatLabel,
        base64
      });
    } catch (err) {
      setError("Failed to extract document context: " + err.message);
      setShowError(true);
    }
  }

  async function exportPageRendition(page, sdk) {
    let format, formatLabel;
    if (page.hasVideoContent) {
      format = sdk.constants.RenditionFormat.mp4;
      formatLabel = "MP4";
    } else {
      format = sdk.constants.RenditionFormat.png;
      formatLabel = "PNG";
    }
    try {
      const rendition = await sdk.app.document.createRenditions(
        {
          range: sdk.constants.Range.specificPages,
          pageIds: [page.id],
          format,
        },
        sdk.constants.RenditionIntent.preview
      );
      const blob = rendition[0].blob;
      // Download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${page.title || page.id}_rendition.${formatLabel.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      // For LLM context (base64)
      const base64 = await blobToBase64(blob);
      setError(`Base64 for LLM (first 100 chars): ${base64.slice(0, 100)}...`);
      setShowError(true);
    } catch (err) {
      setError("Failed to create rendition: " + err.message);
      setShowError(true);
    }
  }

  // Add this function to call the backend and get tasks
  const handleGenerateTasks = async () => {
    setTasksLoading(true);
    setTasksError("");
    setTasks([]);
    // Ensure all required context is present and defined
    if (!Array.isArray(transcriptSegments) || !Array.isArray(selectionHistory)) {
      setTasksError("Transcript and selection history are required.");
      setTasksLoading(false);
      return;
    }
    // Only send selection history and transcript segments
    const payload = {
      transcript_segments: transcriptSegments,
      selection_history: selectionHistory
    };
    console.log("[DEBUG] Payload to /generate-tasks:", payload);
    try {
      const response = await fetch("http://localhost:8000/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Task generation failed");
      const data = await response.json();
      console.log("[DEBUG] LLM response from backend:", data); // Print the full LLM response
      setTasks(data.tasks || []);
      if (!data.tasks || !data.tasks.length) setTasksError("No tasks generated.");
    } catch (err) {
      setTasksError(err.message || "Error generating tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  const handleDeleteTask = (idxToDelete) => {
    setTasks(tasks => tasks.filter((_, idx) => idx !== idxToDelete));
  };

  // 1. Extract ErrorDialog subcomponent
  function ErrorDialog({ showError, setShowError, error }) {
    return (
      <DialogTrigger isOpen={showError} onOpenChange={setShowError} type="modal">
        {null}
        <AlertDialog
          title="Error"
          variant="error"
          primaryActionLabel="OK"
          onPrimaryAction={() => setShowError(false)}
        >
          <Text>{error}</Text>
        </AlertDialog>
      </DialogTrigger>
    );
  }

  // 2. Extract TaskList subcomponent
  function TaskList({ tasks, handleDeleteTask, addOnUISdk, sandboxProxy }) {
    const handleCardHover = (task) => {
      console.log('[DEBUG] Hovering task:', task);
      if (sandboxProxy && typeof sandboxProxy.createOverlayRectangle === 'function') {
        sandboxProxy.createOverlayRectangle({
          x: task.elementPosition?.x,
          y: task.elementPosition?.y,
          width: task.elementSize?.width,
          height: task.elementSize?.height,
          color: '#0078ff',
          opacity: 0.15
        });
        console.log('[DEBUG] Called sandboxProxy.createOverlayRectangle');
      } else {
        console.error('[DEBUG] sandboxProxy.createOverlayRectangle not available');
      }
    };

    const handleCardMouseLeave = () => {
      console.log('[DEBUG] Mouse left task card');
      if (sandboxProxy && typeof sandboxProxy.clearHighlight === 'function') {
        sandboxProxy.clearHighlight();
        console.log('[DEBUG] Called sandboxProxy.clearHighlight');
      }
    };

    return (
      <View marginBottom="size-200">
        <Heading level={3} marginBottom="size-300" UNSAFE_style={{ textAlign: 'center', fontSize: 20, fontWeight: 800 }}>Design Critique Tasks</Heading>
        <Flex direction="column" gap="size-100">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              onMouseEnter={() => handleCardHover(task)}
              onMouseLeave={handleCardMouseLeave}
              style={{ marginBottom: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: '#fff', padding: 0, minWidth: 0, border: 'none', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              role="button"
              tabIndex={0}
            >
              <View
                borderRadius="large"
                boxShadow="3"
                backgroundColor="static-white"
                padding="size-300"
                UNSAFE_style={{ minWidth: 0, border: '1px solid var(--spectrum-global-color-gray-200)' }}
            >
              <Flex direction="row" alignItems="center" justifyContent="space-between" marginBottom="size-100">
                <Heading level={4} UNSAFE_style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{task.title}</Heading>
                <ActionButton isQuiet aria-label="Remove task" onPress={() => handleDeleteTask(idx)} UNSAFE_style={{ marginLeft: 8 }}>
                  <CloseIcon aria-label="Remove" />
                </ActionButton>
              </Flex>
              <SpectrumDivider marginY="size-50" />
                <Text UNSAFE_style={{ fontSize: 13, color: 'var(--spectrum-global-color-gray-900)', lineHeight: 1.6 }}>{task.description}</Text>
              {task.person && (
                <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-600)', fontSize: 13, display: 'block', marginTop: 16 }}>
                  @{task.person}
                </Text>
              )}
            </View>
            </div>
          ))}
        </Flex>
      </View>
    );
  }

  // 3. Extract RecordingControls subcomponent
  function RecordingControls({ recording, loading, startRecording, stopRecording, audioBlob, tasksLoading, handleGenerateTasks, transcriptSegments }) {
    return (
      <Flex direction="column" alignItems="center" gap="size-100" marginBottom="size-400">
        <Button
          variant="cta"
          onPress={startRecording}
          isDisabled={recording || loading || (audioBlob && (!transcriptSegments || !transcriptSegments.length))}
          width="100%"
          size="L"
          marginBottom="size-100"
          UNSAFE_style={{ borderRadius: 24 }}
        >
          Record Feedback
        </Button>
        <Button
          variant="secondary"
          onPress={stopRecording}
          isDisabled={!recording || loading}
          width="100%"
          size="L"
          marginBottom="size-100"
          UNSAFE_style={{ borderRadius: 24, color: '#888' }}
        >
          Stop Recording
        </Button>
        {!recording && !loading && audioBlob && transcriptSegments && transcriptSegments.length > 0 && (
          <Button
            variant="cta"
            onPress={() => {
              console.log("[DEBUG] Generate Design Critique Tasks button pressed");
              handleGenerateTasks();
            }}
            isDisabled={tasksLoading}
            width="100%"
            size="L"
            marginBottom="size-100"
            UNSAFE_style={{ borderRadius: 24, position: 'relative', overflow: 'hidden' }}
          >
            {tasksLoading ? (
              <Flex alignItems="center" justifyContent="center" width="100%" height="100%" direction="row" gap="size-100">
                <ProgressCircle
                  isIndeterminate
                  size="S"
                  aria-label="Loading"
                  UNSAFE_style={{ animation: 'fadeIn 0.4s', marginRight: 8 }}
                />
                <Text UNSAFE_style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Generating tasks…</Text>
              </Flex>
            ) : (
              "Generate Design Critique Tasks"
            )}
          </Button>
        )}
      </Flex>
    );
  }

  // Add fade-in animation for spinner
  const style = document.createElement('style');
  style.innerHTML = `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`;
  document.head.appendChild(style);

  return (
    <View marginY="size-400" width="100%" maxWidth="320px" backgroundColor="static-gray-50" borderRadius="large" padding="size-400" boxShadow="3" position="relative" UNSAFE_style={{ boxSizing: 'border-box', overflowX: 'hidden', marginLeft: 'auto', marginRight: 'auto', fontFamily: 'Adobe Clean, Arial, sans-serif', background: 'var(--spectrum-global-color-gray-50)', outline: '2px dashed #0078ff' }}>
      <Heading level={2} marginBottom="size-100" UNSAFE_style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, letterSpacing: 0.2 }}>SaySo</Heading>
      <Text marginBottom="size-200" UNSAFE_style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--spectrum-global-color-gray-700)', fontWeight: 500 }}>
        Feedback that <span style={{ color: 'var(--spectrum-global-color-blue-600)' }}>sticks</span> before it <span style={{ color: 'var(--spectrum-global-color-blue-600)' }}>slips</span>.
      </Text>
      {(!tasks || tasks.length === 0) && (
        <Text marginBottom="size-300" UNSAFE_style={{ display: 'block', textAlign: 'center', fontSize: 14, color: 'var(--spectrum-global-color-gray-600)' }}>
          Press <b>Record Feedback</b> and speak your design critique out loud. As you record, please select the element you are referring to. When finished, press <b>Stop Recording</b>. Your feedback and selections will be transcribed and used to generate actionable suggestions.
        </Text>
      )}
      <RecordingControls
        recording={recording}
        loading={loading}
        startRecording={startRecording}
        stopRecording={stopRecording}
        audioBlob={audioBlob}
        tasksLoading={tasksLoading}
        handleGenerateTasks={handleGenerateTasks}
        transcriptSegments={transcriptSegments}
      />
      {tasksError && (
        <View backgroundColor="static-white" borderRadius="medium" padding="size-200" marginY="size-200" UNSAFE_style={{ boxShadow: '0 2px 8px rgba(224, 0, 0, 0.08)', border: '1px solid var(--spectrum-global-color-red-200)' }}>
          <Text color="negative" UNSAFE_style={{ fontWeight: 600, fontSize: 15 }}>{tasksError}</Text>
        </View>
      )}
      {tasks && tasks.length > 0 && (
        <TaskList tasks={tasks} handleDeleteTask={handleDeleteTask} addOnUISdk={addOnUISdk} sandboxProxy={sandboxProxy} />
      )}
      {contextSummary && (
        <View marginBottom="size-200">
          <Heading level={3} marginBottom="size-100">Document Context Summary</Heading>
          <Text>Type: {contextSummary.type}</Text>
          <Text>Format: {contextSummary.format}</Text>
          <Text>Base64 (first 100 chars): {contextSummary.base64.slice(0, 100)}...</Text>
        </View>
      )}
      <ErrorDialog showError={showError} setShowError={setShowError} error={error} />
    </View>
  );
} 