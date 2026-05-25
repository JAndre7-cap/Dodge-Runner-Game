# 🟩 Dodge Runner

A fast-paced browser dodging game where you avoid falling obstacles, collect power-ups, and climb the leaderboard. Built with vanilla HTML, CSS, and Canvas.

---

## 🎮 How to Play

Dodge the falling red blocks for as long as possible. The longer you survive, the higher your score — and the faster it gets.

- Move **left/right** to avoid obstacles
- Collect **power-up orbs** for temporary advantages
- Survive through levels that increase in speed every 30 seconds

---

## 🕹️ Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Move Left | `←` Arrow or `A` | Tap left half |
| Move Right | `→` Arrow or `D` | Tap right half |
| Pause | `P` or `Escape` | ⏸ HUD button |
| Resume | `P` or `Escape` | ▶ Resume button |

---

## ✨ Power-Ups

| Icon | Name | Effect | Duration |
|---|---|---|---|
| 🔵 | **Shield** | Destroys one obstacle on contact | 5s |
| 🟡 | **Slow Mo** | Halves the fall speed of all objects | 7s |
| 🟣 | **2× Points** | Doubles your score rate | 10s |

---

## 🌍 Themes

Select a theme from the start screen:

- ☀️ **Sunny Day** — sky blue
- 🌙 **Starry Night** — dark navy
- 🚀 **Deep Space** — black
- 🌊 **Underwater** — deep blue

---

## 🏆 Leaderboard

Your top 5 scores are saved locally in your browser. The leaderboard is shown on the Game Over screen after each run.

---

## 📁 File Structure

```
dodge-runner/
├── index.html       # Game layout, HUD, overlays
├── style.css        # Styling, themes, responsive layout
├── script.js        # Game logic, canvas rendering, input handling
├── favicon.svg      # Browser tab icon
└── README.md        # This file
```

---

## 🚀 Running the Game

No build tools or dependencies required. Just open `index.html` in any modern browser:

```bash
open index.html
# or drag and drop into your browser
```

For local development with live reload, a simple server works well:

```bash
npx serve .
# or
python -m http.server 8000
```

---

## 📱 Mobile Support

The game is fully playable on mobile. On smaller screens the game expands to fill the viewport and the canvas switches to full-screen touch controls automatically.

---

## 🛠️ Built With

- **HTML5 Canvas** — rendering
- **Web Audio API** — procedural sound effects
- **localStorage** — persistent leaderboard
- Vanilla **JavaScript**, **HTML**, and **CSS** — no frameworks or dependencies
