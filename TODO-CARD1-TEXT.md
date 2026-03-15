# Task: Add centered text to GridStage Card 1

**Goal**: Card 1 ("¿Qué es Arlequín?"): center text "¿Qué es\nArlequín?" on image (white, black border, shadow)

## Plan
**Current structure**:
```
.grid-card .card-back (image container)
  img (card back)
```
**Changes**:
1. **GridStage.jsx**: Render text overlay only for index===0 inside .card-back
2. **GridStage.css**: Add `.card-text-overlay` styles (absolute center, white text, black stroke, shadow)

**Text**:
```
¿Qué es
Arlequín?
```

**Style**: `color: white; -webkit-text-stroke: 1px black; text-shadow`

**Files**: GridStage.jsx + GridStage.css

**Current Progress**: Starting implementation

**Confirmed**: Text only on static/idle state of card 1

- [x] Step 1: GridStage.jsx - Add conditional text overlay for index===0 ✅
- [x] Step 2: GridStage.css - Add `.card-text-overlay` styles (dark mode fixed) ✅
- [x] Step 3: Test positioning & visibility during merging ✅

**Complete** 🎉

