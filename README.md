<div align="center">
  <img src="https://raw.githubusercontent.com/thisbansal/AresApp/main/webos-meta/icon.png" alt="Runex Icon" width="150" />

  # Runex: Premium WebOS Plex Client
  
  *A cinematic, high-performance, custom Plex client engineered exclusively for LG webOS.*
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Platform: WebOS](https://img.shields.io/badge/Platform-LG%20webOS-ec008c.svg)]()
  [![React](https://img.shields.io/badge/Framework-React-61dafb.svg)]()
</div>

---

## 🌟 Overview

**Runex** is a beautifully crafted, ground-up reimagining of the Plex media experience specifically tailored for LG Smart TVs running webOS. Frustrated by sluggish interfaces and clunky remote navigation? Runex leverages the power of React and a custom-built spatial navigation engine to deliver a fluid, native-feeling, and visually stunning cinematic experience right to your living room.

From dynamic Hero Banners that showcase transparent clearLogos to a hardware-accelerated video player that natively supports LG's Magic Remote pointer and scroll wheel, every interaction is designed to feel magical.

## ✨ Key Features

### 🎮 Advanced Spatial Navigation Engine
- **Magic Remote Native:** Flawlessly transitions between standard D-Pad spatial navigation and LG Magic Remote free-cursor pointing.
- **Intelligent Focus Tracking:** Retains your exact focus history as you dive into settings panels, modals, and deep library hierarchies.
- **Scroll-to-Navigate Mapping:** Use the Magic Remote scroll wheel to naturally glide through horizontal carousels or vertically traverse the expanded Navigation Bar.

### 🎥 Unmatched Cinematic UI
- **Plex Artwork Integration:** Automatically fetches `clearLogos` with preserved alpha channels (transparency) to render breathtaking Hero Banners instead of generic text.
- **Glassmorphism & Micro-animations:** Premium UI design featuring subtle backdrop blurs, fluid focus scaling, and seamless view transitions.
- **Multi-Library Hub:** Aggregates your "Continue Watching" and "Recently Added" media across multiple active Plex servers simultaneously.

### ⚙️ High-Performance Playback
- **Custom Player HUD:** A bespoke video player interface featuring a precision seekbar, audio/subtitle track selection, and granular media codec insights.
- **Format Flexibility:** Leverages Shaka Player and native MSE (Media Source Extensions) for Direct Play of HEVC, H.264, and dynamically triggers Plex Transcoding for unsupported formats.
- **Advanced Subtitle Rendering:** Supports native `<track>` text extraction for `.srt` and `.vtt`, native rendering for `.pgs` formats, with advanced `.ass` support currently in the works.

### 🔐 Multi-User & Multi-Server
- **Secure PIN Entry:** Fully supports Plex Home user switching with an interactive, TV-optimized numerical PIN pad.
- **Multi-Server Aggregation:** Securely authenticate with multiple servers and switch between them instantly.

---

## 🛠️ Technology Stack

- **Core:** React, Vite, React Router
- **State Management:** Zustand
- **Media Engine:** Shaka Player, Native HTML5 Video
- **Platform Integration:** LG webOS APIs (`@enact/webos`)

---

## 🤝 Contributing
Contributions, bug reports, and feature requests are welcome! Feel free to open an issue or submit a pull request if you want to help make Runex the ultimate smart TV Plex client.

## 📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
<div align="center">
  <i>Built with ❤️ for home theater enthusiasts.</i>
</div>
