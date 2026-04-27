╔══════════════════════════════════════════════════════════════════════════════╗
║                         ZARA QUALITY ANALYZER                              ║
║                      Installation and usage guide                          ║
║                      © 2026 Carlos Romero · All Rights Reserved            ║
╚══════════════════════════════════════════════════════════════════════════════╝


────────────────────────────────────────────────────────────────────────────────
  WHAT IS THIS APPLICATION?
────────────────────────────────────────────────────────────────────────────────

Zara Quality Analyzer is a local web application that analyzes the quality of
Zara garments. It allows you to search by reference code or upload photos of
the inner labels to obtain:

  · Material composition (% cotton, polyester, linen, etc.)
  · Quality score from 1 to 10
  · Label type and garment range
  · Image of the garment (if available in store)
  · Fabric description and usage recommendations


────────────────────────────────────────────────────────────────────────────────
  PREREQUISITES
────────────────────────────────────────────────────────────────────────────────

Before using the application you need to have installed on your computer:

  1. Node.js (version 18 or higher)
     Free download at: https://nodejs.org
     → Choose the "LTS" version (recommended)
     → Install with all default options
     → To verify it is installed, open CMD and type: node --version

  2. Internet connection
     The application needs internet to:
       - Browse the Zara website (get name and composition)
       - Call Anthropic's AI for analysis
       - Call SerpApi to search for the product image


────────────────────────────────────────────────────────────────────────────────
  FILE STRUCTURE
────────────────────────────────────────────────────────────────────────────────

  APP/
  ├── index.html        → Web interface of the application
  ├── server.js         → Node.js server (application engine)
  ├── .env              → API keys (DO NOT share this file)
  ├── iniciar.bat       → Startup script (double-click to launch)
  ├── package.json      → Dependency configuration
  ├── node_modules/     → Installed libraries (generated automatically)
  └── README.txt        → This file


────────────────────────────────────────────────────────────────────────────────
  STEP 1 · CONFIGURE API KEYS
────────────────────────────────────────────────────────────────────────────────

The application needs two API keys to work. They are stored in the
".env" file (inside the APP folder).

  IMPORTANT: This file may be hidden on Windows. To see it:
  → Click on "View" in the top bar
  → Enable "Hidden items"

  Open the .env file with Notepad. You will see something like this:

    CLAUDE_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXX
    SERPAPI_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

  Paste your API keys

  Save the .env file after pasting the keys.


────────────────────────────────────────────────────────────────────────────────
  STEP 2 · FIRST INSTALLATION (only the first time)
────────────────────────────────────────────────────────────────────────────────

The first time you use the application you need to install the dependencies:

    1. Type the following command in cmd and press Enter:

         npm install

    2. Wait for it to finish (may take 2-3 minutes the first time)
       You will see the message: "added X packages"

  NOTE: If you already have the "node_modules" folder inside APP, this step
  is already done and you can skip directly to Step 3.


────────────────────────────────────────────────────────────────────────────────
  STEP 3 · START THE APPLICATION
────────────────────────────────────────────────────────────────────────────────

Once the keys are configured and the dependencies installed:

    1. DOUBLE-CLICK on the "iniciar.bat" file

    2. A black console window will open with the message:
         =============================================
         Zara Quality  →  http://localhost:3000
         Claude:   CONNECTED
         SerpApi:  CONNECTED
         Puppeteer: active
         =============================================

    3. Open your browser (Chrome recommended) and go to:
         http://localhost:3000

    4. The application will be ready to use

  IMPORTANT: Do not close the console window while using the app.
  If you close it, the application will stop working.

  To close the application: close the console window or press Ctrl+C.


────────────────────────────────────────────────────────────────────────────────
  HOW TO USE THE APPLICATION
────────────────────────────────────────────────────────────────────────────────

  ── Search by reference code ─────────────────────────────────────────────

  This is the most accurate method. The code is found on the inner
  composition label.

  Code format: XXXX/XXX/XXX  (example: 4495/322/712)

  ── Search by label photo ────────────────────────────────────────────────

  Press the "Photo" button to see the options:

  BASIC ANALYSIS (1 photo):
    · Photograph the neck label of the garment (the black or white one
      with the ZARA logo and size)
    · Approximate result — does not include exact material composition

  FULL ANALYSIS (2 photos):
    · Photo 1: inner label with reference code (barcode)
    · Photo 2: label with material composition (percentages)
    · Both labels are sewn inside the garment
    · Complete result with exact composition and precise score

  You can also paste an image directly with Ctrl+V.

  ── Dark mode ────────────────────────────────────────────────────────────

  Press the moon/sun button to switch
  between light and dark mode. The preference is saved automatically.


────────────────────────────────────────────────────────────────────────────────
  INTERPRETING RESULTS
────────────────────────────────────────────────────────────────────────────────

  QUALITY SCORE:
    1.0 - 5.0  │ Red    │ Low quality (mostly synthetics)
    5.0 - 6.0  │ Orange │ Standard quality
    6.0 - 7.0  │ Yellow │ Medium-high quality
    7.0 - 9.0  │ Green  │ Good quality (natural blends)
    9.0 - 10.0 │ Green  │ Premium quality (noble fibres)

  ZARA LABEL TYPES:
    White · black letters  → Basics, basic range
    White · grey letters   → Standard collection
    Black · white letters  → High range (ZW Collection)
    Dark  · dark letters   → Premium (Studio / SRPLS)

  MATERIAL PILLS:
    Green  → Natural fibres (cotton, linen, wool, silk...)
    Yellow → Artificial fibres (viscose, lyocell, modal...)
    Pink   → Synthetic fibres (polyester, nylon, acrylic...)


────────────────────────────────────────────────────────────────────────────────
  TECHNICAL NOTES
────────────────────────────────────────────────────────────────────────────────

  · The application does NOT store any personal data or search history.
  · Each search consumes approximately:
      - 1 Claude API call
      - 1-2 SerpApi calls
  · Photo analysis uses Claude Sonnet.
  · The app runs locally only — it is not accessible from the internet.
  · Compatible with Windows 10/11. Requires Node.js v18+.

────────────────────────────────────────────────────────────────────────────────

  Developed by Carlos Romero López · 2026
  © All Rights Reserved

