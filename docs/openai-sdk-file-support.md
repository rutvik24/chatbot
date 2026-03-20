# File & image support (official `openai` SDK)

This app uses the **[`openai` npm package](https://www.npmjs.com/package/openai)** for chat completions. Attachments are turned into **`ChatCompletionContentPart`** values that match the SDK / OpenAPI types.

## References

| Topic | Link |
|--------|------|
| Package overview & `toFile` / `files.create` | [npm: openai](https://www.npmjs.com/package/openai) (**File uploads** section) |
| Chat Completions API | [API reference — Chat](https://platform.openai.com/docs/api-reference/chat) |
| Vision (images) | [Vision guide](https://platform.openai.com/docs/guides/vision) |
| File parts in messages (`file_data`, `file_id`) | [Text / file inputs](https://platform.openai.com/docs/guides/text) |

## What we send today

1. **Images** — `{ type: 'image_url', image_url: { url, detail?: 'auto' \| 'low' \| 'high' } }`  
   `url` may be a **`data:<mime>;base64,...`** data URL (supported by the SDK types).

2. **PDFs & other binaries** — `{ type: 'file', file: { filename, file_data } }`  
   `file_data` is **raw base64** (no `data:` prefix), as in the SDK’s `ChatCompletionContentPart.File` shape.

3. **Plain text–like files** — inlined as a **`{ type: 'text', text: '...' }`** part (truncated if very long), which avoids binary upload for `.txt` / `.json` / etc.

## Types in code

- **`ChatCompletionMessageParam`** / **`ChatCompletionContentPart`** are imported from `openai/resources/chat/completions` in `src/utils/chat-completion-history.ts`.
- Streaming is still `client.chat.completions.create({ messages, model, stream: true })` in `src/services/openai-compatible-chat.ts`.

## Optional: `files.create` + `file_id` (official OpenAI)

The npm docs recommend **`toFile`** + **`client.files.create`** for uploads. If you target **only** `https://api.openai.com/v1`, you can upload first with purpose such as **`user_data`** or **`vision`**, then pass **`file_id`** in the message instead of **`file_data`**.

Helper: `src/utils/openai-chat-file-helpers.ts` → **`createUploadableFileFromBase64`**.

```ts
import OpenAI from "openai";
import { createUploadableFileFromBase64 } from "@/utils/openai-chat-file-helpers";

const file = await createUploadableFileFromBase64(b64, "doc.pdf", {
  mimeType: "application/pdf",
});
const created = await client.files.create({ file, purpose: "user_data" });
// Then in messages: { type: "file", file: { file_id: created.id, filename: "doc.pdf" } }
```

**Gateways** (OpenRouter, etc.) often expect **inline** multimodal parts; the app’s default path stays **inline `file_data`** for broad compatibility.

## Provider caveats

- Many **free / text-only** models return **404** or **400** if you send images or files — pick a **vision / multimodal** model when using attachments.
