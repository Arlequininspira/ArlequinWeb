# Animation Implementation Plan

## Information Gathered

After analyzing the codebase, I found:

1. **App.jsx**: 
   - Has ANIMATION_PHASE state management with phases: idle → logoShrinking → maskEntering → maskMeeting → maskOpening → contentVisible → reverseClosing → logoRestoring → idle
   - Logo is displayed with isShrinking=true during animation phases
   - Handles reverse animation through handleMaskSystemReset()

2. **LogoAnimation.jsx**:
   - Already has isShrinking prop support
   - CSS scales to 0.72 when shrunk
   - Has onShrinkComplete callback

3. **LogoAnimation.css**:
   - `.logo-container.shrunk .logo-canvas { transform: scale(0.72); }`
   - Transition: transform 0.5s ease

4. **ArlequinMask.jsx**:
   - Has MASK_STATE: HIDDEN, ENTERING, MEETING, OPEN, CLOSING, EXITING
   - animationPhase controls the state
   - Transforms: ENTERING from -100vw/100vw, MEETING at 0, OPEN at -15%/15%, EXITING back to -100vw/100vw

5. **ArlequinMask.css**:
   - Transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)
   - Masks meet at center with 0px gap

6. **QuestionStage.jsx**:
   - Displays "¿Conoces a Arlequín?" with SÍ/NO buttons

## Implementation Issues Identified

1. **Logo animation**: Logo remains shrunk during reverse, needs to restore to full size
2. **Mask opening**: translateX(-15%)/15% may be too narrow for text
3. **Timing**: Need to ensure proper synchronization
4. **Reverse sequence**: Logo should restore AFTER masks close but BEFORE they exit

## Implementation Plan

### Step 1: Fix LogoAnimation CSS
- Add a `.restoring` class that returns logo to scale(1)
- Ensure smooth transition when restoring

### Step 2: Adjust ArlequinMask opening distance
- Increase from 15% to approximately 20-25% to create adequate space for text
- Keep masks visible as part of the frame (not disappearing)

### Step 3: Update ArlequinMaskSystem.jsx
- Ensure proper phase handling
- Add proper delay before showing QuestionStage

### Step 4: Update App.jsx
- Fix reverse animation logic
- Ensure logo restores at the right time
- Fix the LogoAnimation to use restoring state during reverseClosing/logoRestoring

### Step 5: Test and refine timing
- Ensure ~150-200ms pause when masks meet
- Verify smooth transitions throughout

## Files to Edit
1. src/components/LogoAnimation.css - Add restoring state
2. src/components/ArlequinMask.css - Adjust opening distance
3. src/components/ArlequinMask.jsx - Verify state transitions
4. src/components/ArlequinMaskSystem.jsx - Verify coordination
5. src/App.jsx - Fix reverse animation sequence and logo restore timing

## Animation Phases Sequence
```
Forward:
1. idle (logo at full size)
2. logoShrinking (logo shrinks to 72%)
3. maskEntering (masks slide in from sides)
4. maskMeeting (masks meet at center, pause 150-200ms)
5. maskOpening (masks open slightly)
6. contentVisible (escudo + question appears)

Reverse:
1. reverseClosing (masks close to center)
2. logoRestoring (logo restores to full size)
3. Masks exit (slide away and disappear)
4. idle (back to start)
```

