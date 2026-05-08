# The Design System: Editorial Finance

## 1. Overview & Creative North Star: "The Warm Architect"
The financial sector is often defined by sterile blues or aggressive, high-contrast dark modes. This design system rejects the "cold calculator" aesthetic in favor of **"The Warm Architect."** 

Our North Star is a high-end editorial experience that feels as much like a premium broadsheet as it does a fintech tool. We achieve this through **Intentional Asymmetry** and **Tonal Depth**. By leaning into warm neutrals (`#fcf9f5`) and vibrant, sun-drenched oranges (`#f28500`), we create an environment that feels human, approachable, and authoritative. We move away from rigid grids by using generous, varied white space to guide the eye, making complex payroll data feel breathable and curated rather than overwhelming.

---

## 2. Colors: Tonal Sophistication
We do not use black and white. We use a palette of "living" neutrals that respond to the primary warmth of our brand orange.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. 
*   **The Technique:** Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly on a `surface` background. The change in tone is the boundary.
*   **Surface Hierarchy:** Treat the UI as stacked sheets of fine paper. Use `surface-container-lowest` (#ffffff) for the most elevated elements (like active cards) and `surface-dim` (#dcdad6) for background utility areas.

### Glass & Gradient Signature
To elevate the experience beyond "standard flat UI":
*   **The "Solar" Gradient:** For primary CTAs and hero analytics, use a linear gradient from `primary` (#904d00) to `primary_container` (#f28500). This adds a physical "soul" to the button that flat color cannot replicate.
*   **Softened Glass:** For floating navigation or modals, utilize `surface-container-low` at 80% opacity with a `24px` backdrop blur. This allows the warm background tones to bleed through, integrating the element into the page.

---

## 3. Typography: The Editorial Scale
We pair the geometric precision of **Inter** with the character-rich **Manrope** to create a hierarchy that feels both modern and deeply trustworthy.

*   **Display & Headlines (Manrope):** These are our "Editorial Hooks." Use `display-lg` (3.5rem) for big-picture financial totals. The wider tracking and unique letterforms of Manrope convey a sense of bespoke craftsmanship.
*   **Title & Body (Inter):** This is our "Data Workhorse." Inter is used for all functional labels and financial line items. Its high x-height ensures that a "8" never looks like a "0" at small sizes.
*   **The Hierarchy Intent:** Use `headline-sm` for section headers, but keep the `on_surface_variant` (#564335) color to soften the impact, reserving the pure `on_surface` (#1c1c19) for critical data points.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often a crutch for poor layout. In this system, depth is earned through tone.

*   **The Layering Principle:** 
    *   **Level 0 (Base):** `surface` (#fcf9f5)
    *   **Level 1 (Sections):** `surface-container-low` (#f6f3ef)
    *   **Level 2 (Cards/Interaction):** `surface-container-lowest` (#ffffff)
*   **Ambient Shadows:** If an element must float (e.g., a critical notification), use a "Sunlight Shadow": `blur: 32px`, `y-offset: 8px`, Color: `on_surface` at 6% opacity. It should look like a soft hum of light, not a dark smudge.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in a high-density table), use `outline_variant` (#dcc1ae) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Financial Primitives

### Cards & Data Lists
*   **No Dividers:** Forbid the use of horizontal lines between payroll entries. Use `spacing-4` (1rem) of vertical white space or alternating `surface` and `surface-container-low` backgrounds.
*   **The "Value Highlight":** Financial figures in cards should use `title-lg` and be paired with a `primary` (#904d00) accent icon to signify importance.

### Buttons (The Interaction Core)
*   **Primary:** `primary_container` (#f28500) background with `on_primary_container` (#582d00) text. Use `rounded-md` (0.375rem) to maintain a professional, architectural edge.
*   **Secondary:** No background. Use a `Ghost Border` (outline-variant at 20%) and `primary` text.
*   **States:** On hover, primary buttons should shift to `primary` (#904d00) to show "weight" and "depth."

### Input Fields
*   **Structure:** Inputs use `surface-container-highest` (#e5e2de) with no border. On focus, the bottom edge gains a 2px `primary` (#f28500) "underline" accent. 
*   **Legibility:** Use `body-md` for input text and `label-sm` for floating labels to keep the interface compact but readable.

### Signature Component: The "Pay-Period Pulse"
A custom progress visualization using a thick 8px track of `surface-variant` and a `primary` filled indicator, representing the current status of a payroll cycle. This replaces boring "Status: Pending" text with a visual narrative.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical padding. Give a headline more top-padding than bottom-padding to create an editorial "flow."
*   **Do** use `tertiary` (#006496) sparingly for "Success" or "Verified" states to provide a cool contrast to the warm orange.
*   **Do** lean on the spacing scale. Use `spacing-12` (3rem) for major section breaks to ensure the app feels premium and unhurried.

### Don't
*   **Don't** use pure #000000 or #FFFFFF for anything other than absolute white backgrounds. It breaks the "Warm Architect" warmth.
*   **Don't** use 90-degree corners for buttons. It feels too aggressive for a payroll app. Stick to the `md` (0.375rem) or `lg` (0.5rem) roundedness scale.
*   **Don't** use "Alert Red" for everything. Use `error_container` (#ffdad6) with `on_error_container` text for a sophisticated, less-alarming "Needs Attention" state.