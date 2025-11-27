# Navigation-Aware Output Formatting System for Blind Users

This project is a JavaScript-based web application that helps blind and visually impaired users consume digital content in a more structured and accessible way.

Instead of presenting information as one long block, the system **analyzes page structure**, **extracts navigation landmarks**, and **formats output intelligently**, allowing screen-reader users to navigate content efficiently.

> **Note:** The content structuring pipeline in this project uses **Google Gemini** for analysis and response formatting.

---

## Key Features

- **Navigation-aware formatting**  
  Organizes content into semantic sections (headings, lists, paragraphs) and exposes them as navigable units.

- **Screen-reader friendly design**  
  Uses semantic HTML + ARIA landmarks optimized for assistive technologies.

- **Configurable verbosity**  
  Users can choose concise summaries or detailed content output.

- **Keyboard-only navigation**  
  Fully operable without a mouse using intuitive shortcuts.

- **Modular architecture**  
  Clear separation between frontend and backend for easy extension.

---
## Compliance with Accessibility Rules for Blind Users

This project strictly follows the **accessibility and usability guidelines designed for blind and visually impaired users**, ensuring that all output formatting and navigation behavior aligns with standards for assistive technology.

The system includes features that **follow the rules for blind-friendly content interaction**, such as:

- Proper **semantic structure** (headings, lists, paragraphs, regions)
- **ARIA landmarks & roles** to support screen-reader navigation
- Logical **focus order and keyboard operability**
- Content segmentation that enables **step-by-step auditory consumption**
- Support for turning long visual content into **structured, screen-reader-optimized output**
- Following **WCAG (Web Content Accessibility Guidelines)** principles for non-visual access
