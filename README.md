# AI Frontend Agent

An autonomous AI-powered frontend development agent that transforms natural-language requests into complete, working websites, rendered live in the browser. Built with Gemini AI, Next.js, and TypeScript.

## Features

✨ **Multi-Language Support**
- Understand requests in English, Urdu, Roman Urdu, Hindi, Arabic, Bengali, or mixed languages
- Example: "mujhy Fakiri Marham ki premium ecommerce website banani hai green theme mai"

🤖 **Autonomous Code Generation**
- Analyze requirements
- Plan website structure
- Generate complete site files
- Serve a live in-browser preview instantly (no build step)

🎨 **Modern UI/UX**
- File explorer with directory tree
- Code editor with syntax highlighting
- Live website preview in iframe
- Chat history that survives a page refresh
- Per-change "what changed" summary with one-click revert
- Dark developer-tool aesthetic

🛠️ **Default Stack: HTML, CSS, Bootstrap, JS**
- Every site is plain HTML/CSS/Bootstrap(CDN)/vanilla JS by default - no npm install, no build step
- A different stack (React, Next.js, Tailwind, etc.) is only used if the user explicitly asks for it by name

🔄 **Iterative Development**
- Modify the current in-session site without regenerating everything
- Add new features incrementally
- Update styling and layout
- Preserve existing functionality

📦 **Ephemeral by Design**
- Generated site code lives only in server memory for the current session - it is never written to disk
- A page refresh clears the generated site and starts a clean workspace (chat history is unaffected)

## Architecture

### Backend Components

- **Chat API Route** (`/app/api/chat/route.ts`): Gemini integration with tool execution
- **Gemini Integration** (`/lib/gemini.ts`): Tool-calling via the official `@google/genai` SDK
- **Virtual File System** (`/lib/virtual-fs.ts`): In-memory (not disk) file store the agent's tools operate on
- **History Store** (`/lib/history-store.ts`): Persists chat messages and per-turn file-change snapshots (for revert) to a local JSON file
- **Preview Serving** (`/app/api/preview-serve/[...path]/route.ts`): Serves in-memory files with correct MIME types so the Preview iframe can load `index.html` plus its relative `css`/`js`/asset links
- **Agent Planner** (`/lib/agent/planner.ts`): System prompt and planning

### Frontend Components

- **Workspace** (`/components/Workspace.tsx`): Main layout orchestrator
- **Chat Panel** (`/components/ChatPanel.tsx`): User input, message display, per-turn change summary + revert
- **File Explorer** (`/components/FileExplorer.tsx`): In-memory file tree navigation
- **Code Editor** (`/components/CodeEditor.tsx`): File content display
- **Preview** (`/components/Preview.tsx`): Live website preview with build status

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create `.env.local` (see `.env.example`):
```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Get your free-tier API key from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Example Workflows

#### 1. E-commerce Landing Page
**Input:**
```
"mujhy ek perfume ecommerce website chahiye black aur gold theme mai"
```

**Agent will:**
- Create `index.html`, `style.css`, `script.js` using Bootstrap
- Implement a product grid and add-to-cart interactions
- Apply black and gold color scheme
- Make it mobile responsive

#### 2. Portfolio Website
**Input:**
```
"Create a modern developer portfolio"
```

**Agent will:**
- Build the portfolio structure in plain HTML/CSS/Bootstrap/JS
- Display projects and skills
- Implement a contact form
- Only reach for React/Next.js/etc. if you explicitly ask for that stack

#### 3. Modify the Current Site
After initial generation, you can say:

- "navbar ko red kar do" → Update navbar color
- "mobile responsive bana do" → Make responsive
- "cart feature add karo" → Add shopping cart
- "Dark mode lagao" → Add dark theme

#### 4. Revert a Change
Every assistant message that changed files shows a "N files changed" summary with a **Revert** button - click it to restore those specific files to what they were before that turn.

## Security Considerations

✅ **Implemented**
- API key stored server-side only
- Generated code never touches disk - no path-traversal surface for the generated site
- Preview iframe is sandboxed (`allow-scripts allow-popups allow-forms`, no `allow-same-origin`) so generated code can't reach the parent app's cookies/storage/DOM
- Local chat/change history file is git-ignored

## Agent Tools

The Gemini agent has access to (all operate on the in-memory workspace only):
- `read_file` - Read file contents
- `write_file` - Create new files
- `update_file` - Modify existing files
- `delete_file` - Remove files
- `list_files` - Browse the current in-memory structure

## Technology Stack

- **Generated sites (default)**: Plain HTML, CSS, Bootstrap (CDN), vanilla JavaScript
- **This app itself**: Next.js 16, React, TypeScript, Tailwind CSS
- **AI**: Google Gemini via the official `@google/genai` SDK (free tier)
- **Icons**: Lucide React

## Project Structure

```
agent-app/
├── app/
│   ├── api/
│   │   ├── chat/route.ts                  # Gemini API endpoint
│   │   ├── files/route.ts                 # In-memory file tree
│   │   ├── files/content/route.ts         # In-memory file content
│   │   ├── history/route.ts               # Chat/change history
│   │   ├── history/rollback/route.ts      # Revert a turn's changes
│   │   ├── preview-serve/[...path]/route.ts  # Serves the in-memory site for the Preview iframe
│   │   └── workspace/reset/route.ts       # Clears the in-memory site (called on page load)
│   ├── page.tsx                  # Main page
│   └── layout.tsx                # Root layout
├── components/
│   ├── ChatPanel.tsx             # Chat interface + change history/revert
│   ├── CodeEditor.tsx            # Code display
│   ├── FileExplorer.tsx          # File tree
│   ├── Preview.tsx               # Website preview
│   └── Workspace.tsx             # Main layout
├── lib/
│   ├── gemini.ts                 # Gemini integration
│   ├── virtual-fs.ts             # In-memory file store
│   ├── history-store.ts          # Chat + change history persistence
│   └── agent/
│       └── planner.ts            # Agent planning / system prompt
├── types/
│   └── agent.ts                  # Type definitions
├── .agent-history/                # Local chat/change history (git-ignored)
├── .env.local                    # Environment config
└── package.json
```

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Limitations

- Requires a valid Gemini API key
- Default stack has no server-side/build tooling - it's best suited for static, client-side sites
- A different stack (React/Next.js/etc.) only happens on explicit request, and isn't compiled/served the same way (no build pipeline exists for it yet)
- Generated site code is intentionally not persisted - refreshing the page clears it

## Support

For issues or questions:
1. Check `.env.local` configuration
2. Ensure the Gemini API key is valid
3. Check Gemini API free-tier rate limits
4. Review the browser console for errors

## License

MIT

## Credits

Built with the Gemini API, powered by Google's Gemini language models.
