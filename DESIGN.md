---
version: alpha
name: BiasAnalyzer
description: A Korean YouTube history viewer for inspecting content topics, model estimates, and alternative videos.
colors:
  ground: "#f4f5f6"
  ink: "#25272a"
  muted: "#5f6368"
  action: "#b72e2a"
  progressive: "#335d9e"
  conservative: "#a35324"
typography:
  display:
    fontFamily: Pretendard
    fontSize: 3.45rem
    fontWeight: 760
    letterSpacing: -0.065em
  body:
    fontFamily: Pretendard
    fontSize: 1rem
    lineHeight: 1.8
rounded:
  sm: 3px
  md: 6px
spacing:
  sm: 8px
  md: 20px
  lg: 40px
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: 10px 17px
---

## Overview

The product's central artifact is a watch-history list. The landing page lets
visitors filter five explicitly fictional records; the workspace inspects the
same records as topics, scores, and alternative-content queries. Forms sit next
to useful content rather than following a marketing section waterfall.

This contract follows the audit method in
[avoid-ai-design](https://github.com/funboy322/avoid-ai-design).

## Colors

White is the working surface; cool light gray separates the connection form and
result areas. Graphite carries text and neutral data. Red identifies the YouTube
record import/analysis action. It does not encode a user's political identity.
Blue and burnt orange distinguish content-classification directions and always
appear with written labels. Topic distribution uses restrained slate bars.

Muted text must reach 4.5:1 against its surface. Check both light and dark tokens
when adding components. Dark mode is a saved user preference with a charcoal
surface and readable equivalents of the same semantic colors.

## Typography

Pretendard is loaded in `react/front/public/index.html` for Korean interface
text. One family uses distinct scales: 36–55px landing heading, 26–29px workspace
heading, 16–18px section heading, and 12–15px supporting text. Use tabular numerals
for scores. Do not use monospace, tracked capitals, or colored words as decoration.

## Layout

The landing page opens directly onto a functional record preview and connection
form. The workspace uses horizontal navigation and a shared content canvas.
Its identifying detail is the correspondence between topic bars and filterable
watch-history rows. Keep the record list's importance visible at every width.
Tables scroll inside their own regions on small screens; forms stack vertically.

## Elevation & Depth

Rows and charts stay flat. Shadows belong only to modal dialogs. Separate content
with grouping, spacing, and headings; avoid enclosing every block in a card.

## Shapes

Controls have 3–4px corners. Connection surfaces use 6px corners; dialogs use 7px.
Small round status dots can indicate a running analysis. Do not add orbit rings,
fake window controls, tinted icon tiles, glass layers, or accent-border cards.

## Components

Reuse `Brand`, `Modal`, the button classes, and the tokens in `DesignSystem.css`.
`sampleVideos.js` supplies the landing preview and workspace demo. State plainly
when records, perspective examples, or experiment curves are fictional.

Navigation, record filters, forms, dialogs, empty states, and failures must work
with a keyboard. Preserve focus indicators, text labels, disabled states, and
the existing theme/font-size controls. Render charts without entrance animation.

## Do's and Don'ts

- Let existing records determine counts; never invent adoption or quality stats.
- Keep classification estimates distinct from truth, credibility, and identity.
- Use concrete action labels and show search errors without fabricated results.
- Keep demo filtering and all existing analysis/recommendation endpoints working.
- Do not reintroduce SD4 template labels, SD5 accented headline fragments, SD6
  decorative numbering, SD7 fake browser chrome, or SD8 reflexive green accents.
- Do not replace this direction with a newspaper, terminal, or generic SaaS kit.
