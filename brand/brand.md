# Project Lazarus Brand Guidelines

**"The Legacy Code Necromancer"**

This document defines the visual identity for **Project Lazarus**. The aesthetic is "Void Black + Rail Purple"—utilizing a deep void-black palette with rail purple and electric cyan accents to create a "Glass Brain" aesthetic that conveys autonomous intelligence, transmutation, and modern software engineering.

---

## 1. Brand Core

| Element | Definition |
| :--- | :--- |
| **Name** | Project Lazarus |
| **Tagline** | The Legacy Code Necromancer |
| **Concept** | Autonomous AI platform that transmutes legacy software into modern web applications |
| **Vibe** | Void Black, Glass Brain, Rail Purple, Electric Cyan, Transmutation |

---

## 2. Color Philosophy

### The "Glass Brain" Aesthetic

Our color system creates a deep, immersive environment where **void black backgrounds** provide high contrast for **rail purple** and **electric cyan** elements. The "Glass Brain" concept visualizes the AI's cognition (Plan, Work, Thoughts) through translucent panels and glowing accents.

**Why this works for Project Lazarus:**
- **Void Black (#0A0A0F)**: Represents the "void" from which legacy code is brought back to life.
- **Rail Purple (#6E18B3)**: Represents the "rail" or guided path of transmutation.
- **Electric Cyan (#00E5FF)**: Represents the spark of intelligence and modern technology.

---

## 3. Color Palette Quick Reference

### Background Colors

| Color | Hex | RGB | Role |
| :---: | :--- | :--- | :--- |
| ![#0A0A0F](https://via.placeholder.com/16/0A0A0F/0A0A0F?text=+) | `#0A0A0F` | (10, 10, 15) | **Void Black** (Main Background) |
| ![#1E1E28](https://via.placeholder.com/16/1E1E28/1E1E28?text=+) | `#1E1E28` | (30, 30, 40) | **Slate Grey** (Secondary/Muted) |
| ![#050507](https://via.placeholder.com/16/050507/050507?text=+) | `#050507` | (5, 5, 7) | **Obsidian** (Darker Depth) |

### Foreground Colors

| Color | Hex | RGB | Role |
| :---: | :--- | :--- | :--- |
| ![#6E18B3](https://via.placeholder.com/16/6E18B3/6E18B3?text=+) | `#6E18B3` | (110, 24, 179) | **Rail Purple** (Primary Brand) |
| ![#8134CE](https://via.placeholder.com/16/8134CE/8134CE?text=+) | `#8134CE` | (129, 52, 206) | **Quantum Violet** (Lighter Purple) |
| ![#00E5FF](https://via.placeholder.com/16/00E5FF/00E5FF?text=+) | `#00E5FF` | (0, 229, 255) | **Electric Cyan** (Accent/Intelligence) |
| ![#FAFAFA](https://via.placeholder.com/16/FAFAFA/FAFAFA?text=+) | `#FAFAFA` | (250, 250, 250) | **Cloud White** (Primary Text) |

---

## 4. Background Palette (Void Black & Glass)

These are the structural colors—the canvas on which Project Lazarus operates.

| Token | Hex | Role |
| :--- | :--- | :--- |
| **Background** | `#0A0A0F` | Main canvas, page background |
| **Card** | `rgba(30, 30, 40, 0.4)` | Glass panels (Glass Brain panes) |
| **Muted** | `rgba(30, 30, 40, 0.5)` | Secondary backgrounds, inputs |
| **Border** | `rgba(250, 250, 250, 0.1)` | Borders, dividers (subtle) |

### Usage Guidelines

```css
/* Page background */
background: #0A0A0F;

/* Glass Card */
background: rgba(30, 30, 40, 0.4);
backdrop-filter: blur(12px);
border: 1px solid rgba(250, 250, 250, 0.1);
```

### ⚠️ Accessibility & Usage Rules (Strict)

*   **Rail Purple (#6E18B3)**: Use **ONLY** for graphics, backgrounds, borders, icons, and gradients. **NEVER** use for body text or small labels (Contrast 3.5:1 fails WCAG AA).
*   **Electric Cyan (#00E5FF)**: Safe for text and icons (Contrast 13:1). Use for active states, links, and "intelligence" accents.
*   **Cloud White (#FAFAFA)**: Use for all primary reading text.
*   **Quantum Violet (#8134CE)**: Use for text that needs to be purple (lighter than Rail Purple).

---

## 5. Foreground Palette (Rail & Spark)

The gradients represent the flow of data and the transformation process.

| Token | Hex | Role |
| :--- | :--- | :--- |
| **Rail Purple** | `#6E18B3` | Primary actions, brand identity |
| **Electric Cyan** | `#00E5FF` | Active states, code execution, "intelligence" |
| **Success** | `#00FF88` | Successful transmutation/test |
| **Warning** | `#FFB800` | Issues requiring attention |
| **Error** | `#FF3366` | Critical failures |

### Gradient Definition

```css
/* Rail Fade (Primary Brand Gradient) */
background: linear-gradient(135deg, #8134CE 0%, #6E18B3 100%);

/* Automation Flow (Hero/CTA) */
background: linear-gradient(90deg, #00E5FF 0%, #8134CE 50%, #6E18B3 100%);
```

---

## 6. Typography System

**"The Glass Brain Terminal"** — Technical, precise, and readable.

### Font Family Selection

| Role | Font | Usage | Source |
| :--- | :--- | :--- | :--- |
| **Display** | Space Grotesk | H1, H2, H3, Page Titles, Big Metrics | [Google Fonts](https://fonts.google.com/specimen/Space+Grotesk) |
| **Body** | Inter | Paragraphs, Navigation, Buttons, UI | [Google Fonts](https://fonts.google.com/specimen/Inter) |
| **Code** | JetBrains Mono | Code streams, logs, IDs, Work Pane | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) |

### Type Hierarchy

| Element | Font | Weight | Size | Color |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | Space Grotesk | SemiBold (600) | `text-lg` (18px) | `#FAFAFA` |
| **Section Header** | Space Grotesk | SemiBold (600) | `text-sm` (14px) | `#FAFAFA` |
| **Body Text** | Inter | Regular (400) | `text-sm` (14px) | `#FAFAFA` |
| **Muted Text** | Inter | Regular (400) | `text-xs` (12px) | `rgba(250, 250, 250, 0.6)` |
| **Code** | JetBrains Mono | Regular (400) | `text-xs` (12px) | `#FAFAFA` (or syntax highlighted) |

> **Rule:** Never use pure white (`#FFFFFF`) for body text if possible, but `#FAFAFA` (Cloud White) is our standard for legibility against Void Black. Muted text is strictly for metadata.

---

## 7. Logo & Brand Assets

Project Lazarus assets are located in `public/logos/` and `app/`.

### Logo Files

| File | Format | Usage |
| :--- | :--- | :--- |
| `app/icon.svg` | SVG | Primary App Icon / Favicon |
| `public/autorail.svg` | SVG | Brand graphic (Rail concept) |
| `public/logos/*` | SVG/PNG | (If available) Full logos |

### Logo Specifications
* **Primary Icon:** Geometric "L" or Brain/Rail symbol.
* **Colors:** Rail Purple (`#6E18B3`) and Electric Cyan (`#00E5FF`).

### Using Logos in Code

```tsx
import Image from "next/image"

// App Icon
<Image src="/icon.svg" alt="Project Lazarus" width={32} height={32} />

// Brand Graphic
<Image src="/autorail.svg" alt="AutoRail" width={120} height={40} />
```

---

## 8. UI Principles

1. **Void Black Canvas:** Always start with `#0A0A0F`.
2. **Glass Panels:** Use `glass-panel` or `glass-card` for content containers.
3. **Theatrical Motion:** Use subtle animations (`animate-fade-in`, `animate-pulse-glow`) to show the "brain" working.
4. **Information Density:** High density (dashboard style), `text-sm` base size.
5. **Glow Effects:** Use `shadow-glow-purple` or `shadow-glow-cyan` for active states/focus.

---

## 9. Color Combinations

| Background | Foreground | Use Case |
| :--- | :--- | :--- |
| `#0A0A0F` | `#FAFAFA` | Default page content |
| `#0A0A0F` | `#6E18B3` | Primary brand elements |
| `rgba(30, 30, 40, 0.4)` | `#FAFAFA` | Card content |
| `#0A0A0F` | `#00E5FF` | Active/Intelligence accents |

---

## 10. Data Visualization Palette

| Series | Color | Hex | Purpose |
| :--- | :--- | :--- | :--- |
| **Series A** | Rail Purple | `#6E18B3` | Primary metric |
| **Series B** | Electric Cyan | `#00E5FF` | Secondary metric |
| **Series C** | Quantum Violet | `#8134CE` | Tertiary metric |
| **Success** | Green | `#00FF88` | Success/Pass rate |
| **Error** | Red | `#FF3366` | Failure/Error rate |

---

## 11. Favicons & PWA Icons

| File | Purpose |
| :--- | :--- |
| `app/favicon.ico` | Browser tab icon |
| `app/icon.svg` | Modern vector icon |
| `app/apple-icon.png` | iOS touch icon |
| `public/web-app-manifest-*.png` | PWA icons |

---

## 12. Enterprise Standards & Accessibility

**Target:** WCAG 2.1 Level AA compliance. Enterprise-grade, production-ready UI.

### Contrast Ratios (WCAG AA)

| Foreground | Background | Ratio | Pass |
| :--- | :--- | :--- | :--- |
| Cloud White (#FAFAFA) | Void Black (#0A0A0F) | ~16:1 | AAA |
| Electric Cyan (#00E5FF) | Void Black (#0A0A0F) | ~13:1 | AAA |
| Quantum Violet (#8134CE) | Void Black (#0A0A0F) | ~5:1 | AA |
| Rail Purple (#6E18B3) | Void Black (#0A0A0F) | ~3.5:1 | **FAIL** (text) |

**Rule:** Rail Purple is for graphics/icons/borders only. Never for body text or small labels.

### Focus States

All interactive elements must have visible focus indicators:

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

Use `ring-ring` (Quantum Violet) for consistency. Never remove focus outline without providing an alternative.

### Reduced Motion

Support `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

The design system already includes this in `styles/tailwind.css`.

### Text Selection

Maintain brand immersion with styled selection:

```css
::selection {
  background: rgba(0, 229, 255, 0.3);
  color: #FAFAFA;
}
```

### Keyboard Navigation

- All interactive elements must be reachable via Tab
- Focus order must follow visual order
- Modals/dropdowns must trap focus and support Escape to close

### Semantic HTML & ARIA

- Use `<label>` for all form inputs (or `aria-label` when visible label is not appropriate)
- Use `aria-describedby` for helper text
- Use `aria-live` for dynamic content (e.g., confidence updates)
- Icon-only buttons must have `aria-label`

---

## 13. Documentation Reference

| Document | Location |
| :--- | :--- |
| **UI/UX Guide** | `docs/UI_UX_GUIDE.md` |
| **Implementation** | `docs/IMPLEMENTATION.md` |
| **Rules** | `.cursorrules` |

---

*Project Lazarus Brand Guidelines — The Legacy Code Necromancer*
