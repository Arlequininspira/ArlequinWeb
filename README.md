# Star Animation - React + Vite Project

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add the animation images:**
   
   Place your AVIF images in the `public/estrellas/` folder. The images should be named:
   - `estrella_giro_clear_00000.avif`
   - `estrella_giro_clear_00001.avif`
   - ... up to ...
   - `estrella_giro_clear_00190.avif`

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── BackgroundAnimation.jsx    # Main animation component
│   └── BackgroundAnimation.css     # Animation styles
├── App.jsx                         # Main app component
├── App.css                         # App styles
├── index.css                       # Global styles
└── main.jsx                        # Entry point

public/
└── estrellas/                      # Animation frames (191 images)
    ├── estrella_giro_clear_00000.avif
    └── ...
```

## Features

- ✅ Full-screen background animation
- ✅ 191 frames of rotating star animation
- ✅ Smooth 24-30 fps playback using requestAnimationFrame
- ✅ Preloads all images on mount to prevent flickering
- ✅ Infinite loop
- ✅ Stays behind content (z-index: -1)
- ✅ Black background (#000000)
- ✅ Responsive (100vw x 100vh)

## Customization

To adjust the animation speed, modify `FRAME_DURATION` in `src/components/BackgroundAnimation.jsx`:
- Lower value = faster animation
- Higher value = slower animation
- Current: 35ms ≈ 28-30 fps

