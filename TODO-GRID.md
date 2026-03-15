# Task: Simplify GridStage card selection animation

**Goal**: Keep only 'merging' animation (400ms cards to center), remove 'growing' phase, call onCardClick immediately after merging.

## Plan
**Information Gathered**:
- GridStage.jsx animation: 'merging' (400ms) → 'growing' (500ms) → call onCardClick
- getCardStyle has logic for both phases
- User wants: merging only → immediate card component

**Files to edit**:
1. src/components/GridStage.jsx

**Detailed changes**:
1. handleCardClick: remove 'growing' setTimeout, call onCardClick after 400ms merging
2. getCardStyle: remove 'growing' case, use merging style then reset
3. Update animationPhase states (remove 'growing')

**Current Progress**: Starting implementation

- [x] Step 1: Edit GridStage.jsx handleCardClick - Remove growing phase ✅
- [x] Step 2: Edit getCardStyle - Simplify to merging only ✅
- [ ] Step 3: Test animation

