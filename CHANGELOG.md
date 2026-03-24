# Changelog

All notable changes to this project are documented in this file.

## 2026-03-24

### Added

- Added a left-side in-game guide panel with:
  - Controls (move, dash, fire, pause)
  - Power-up descriptions (shield, slow, double score)
  - Enemy and boss behavior summary
- Added multi-shot shooting requirement and implementation:
  - One trigger now fires multiple bullets in a spread pattern
- Added hold-to-fire behavior:
  - Holding `J` continuously fires bullets with cooldown pacing
- Added directional shooting support:
  - Forward, front-left, and front-right trajectories

### Changed

- Upgraded visual presentation to a 3D-style gameplay mode:
  - Perspective camera feel in the playfield
  - Depth-based transform and scaling for player, enemies, power-ups, bullets, and portals
  - Slight scene tilt for stronger spatial perception
- Increased bullet speed to approximately 2x of the previous baseline.

### Docs

- Updated `Readme.md` to reflect:
  - Multi-shot requirement
  - Continuous fire by holding `J`
  - Three-direction firing
  - 2x bullet speed
  - 3D mode adjustment and current gameplay description
