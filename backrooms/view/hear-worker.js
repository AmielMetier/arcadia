// La transcription (voir hear.js) : Whisper dans un Web Worker, par Transformers.js (chargé de jsDelivr, modèle
// téléchargé de Hugging Face par le navigateur et gardé en cache). Un message { id, audio (Float32Array à 16 kHz),
// lang } → { id, text } ; le modèle se charge au premier message.
let asr = null;
let loading = null;
async function boot(model) {
  const tj = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
  tj.env.allowLocalModels = false;
  asr = await tj.pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'wasm' });
}
self.onmessage = async (e) => {
  const { id, audio, lang, model } = e.data;
  try {
    if (!asr) await (loading = loading || boot(model));
    const r = await asr(audio, { language: lang, task: 'transcribe' });
    self.postMessage({ id, text: String((r && r.text) || '').trim() });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
