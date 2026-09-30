# Local Models

Do not commit model weights to this repository. Keep downloaded weights in the model runtime's normal storage or on a separate local drive.

Recommended locations:

- Ollama: let Ollama manage models with `ollama pull <model>`; do not copy its internal blob store into this repository.
- llama.cpp or other file-based runtimes: store weights outside the repository, for example `D:\AI\models`.
- Repository-specific metadata and aliases: copy `config/local-models.example.json` to `config/local-models.json` and edit it.
- Optional local symlinks or notes may go under this directory, but raw `.gguf`, `.safetensors`, `.bin`, and similar files are ignored.

The harness should reference a logical model ID such as `local-coding`, not a hard-coded filesystem path. The provider adapter owns the runtime-specific model path or model name.
