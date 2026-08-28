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

📦 **Ephemeral by Design, Stateless Backend**
- Generated site code lives only in the browser tab's memory for the current session - it is never written to disk or stored server-side
- A page refresh clears the generated site and starts a clean workspace
- Chat history survives a refresh via the browser's `localStorage` - not a server database
- The `/api/chat` route is fully stateless (no in-memory or on-disk server state), so it deploys cleanly to serverless platforms like Vercel

## Architecture

### Backend

- **Chat API Route** (`/app/api/chat/route.ts`): the only backend route. Stateless - it receives the current site's files and chat context in the request, runs the Gemini tool-calling loop against an in-request file map, and returns the updated files plus a change summary. Nothing is read from or written to disk/memory between requests.
- **Gemini Integration** (`/lib/gemini.ts`): Tool-calling via the official `@google/genai` SDK
- **Agent Planner** (`/lib/agent/planner.ts`): System prompt and planning

### Frontend (owns all state)

- **Workspace** (`/components/Workspace.tsx`): Main layout orchestrator. Holds the generated site's files (`Record<path, content>`) in React state, and chat messages in React state + `localStorage`. Builds the file tree and an inlined preview document (CSS/JS inlined into `index.html`) purely client-side.
- **Chat Panel** (`/components/ChatPanel.tsx`): User input, message display, per-turn change summary + revert (revert is a pure client-side state update - no network call)
- **File Explorer** (`/components/FileExplorer.tsx`): File tree navigation over the in-memory file map
- **Code Editor** (`/components/CodeEditor.tsx`): File content display
- **Preview** (`/components/Preview.tsx`): Live website preview via a sandboxed iframe `srcDoc`, build status

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
- API key stored server-side only, never sent to the client
- Generated code never touches disk on the server - no path-traversal surface
- Preview iframe is sandboxed (`allow-scripts allow-popups allow-forms`, no `allow-same-origin`) so generated code can't reach the parent app's cookies/storage/DOM

## Agent Tools

The Gemini agent has access to (all operate on the in-request file map only):
- `read_file` - Read file contents
- `write_file` - Create new files
- `update_file` - Modify existing files
- `delete_file` - Remove files
- `list_files` - Browse the current file structure

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
│   │   └── chat/route.ts         # The only backend route - stateless Gemini endpoint
│   ├── page.tsx                  # Main page
│   └── layout.tsx                # Root layout
├── components/
│   ├── ChatPanel.tsx             # Chat interface + change history/revert
│   ├── CodeEditor.tsx            # Code display
│   ├── FileExplorer.tsx          # File tree
│   ├── Preview.tsx               # Website preview (iframe srcDoc)
│   └── Workspace.tsx             # Main layout + all client-side state
├── lib/
│   ├── gemini.ts                 # Gemini integration
│   └── agent/
│       └── planner.ts            # Agent planning / system prompt
├── types/
│   └── agent.ts                  # Type definitions
├── .env.local                    # Environment config
└── package.json
```

## Deployment (Vercel)

The app is fully stateless server-side, so it deploys to Vercel with no extra configuration:

```bash
vercel login
vercel --prod
```

Then set the environment variables in the Vercel project settings (Settings → Environment Variables):
```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
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
- Generated site code is intentionally not persisted anywhere - refreshing the page clears it, and it isn't shared across browser tabs/devices
- Very large generated sites could approach `localStorage`'s ~5-10MB per-origin limit for chat history (unlikely in normal use)

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
