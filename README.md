# Robot Arm Sandbox

An interactive 3D robot arm simulator built with React, Three.js, and Zustand. Compose arbitrary kinematic chains from modular joint types, solve inverse kinematics in real time, define multi-waypoint paths, and visualize the full forward/inverse kinematics pipeline -- all in the browser.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Kinematic Model](#kinematic-model)
  - [Denavit-Hartenberg Convention](#denavit-hartenberg-convention)
  - [Forward Kinematics](#forward-kinematics)
  - [Inverse Kinematics](#inverse-kinematics)
- [Joint Types](#joint-types)
- [Constraint System](#constraint-system)
- [Multi-Waypoint Pathfinding](#multi-waypoint-pathfinding)
- [Animation Pipeline](#animation-pipeline)
- [State Management](#state-management)
- [Presets](#presets)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

The application follows a unidirectional data flow pattern. A centralized Zustand store holds the complete arm configuration (joint parameters, DH table, IK target, animation state, waypoints, trace data). React components subscribe to slices of this store and render either 2D UI panels or 3D scene elements via React Three Fiber. The kinematics engine is a pure-function library with zero framework dependencies, consumed by both the store actions and the rendering layer.

```
Store (Zustand)
  |
  |-- kinematics.ts    Pure DH transforms, FK, IK solver
  |-- jointDefaults.ts  Default parameters per joint type
  |
  |-- Components
  |     |-- Viewport.tsx        R3F Canvas, 3D scene graph
  |     |-- JointMesh.tsx       Per-joint 3D meshes with drag
  |     |-- WaypointMarkers.tsx Draggable 3D waypoint spheres
  |     |-- PathVisualization   EE trace + planned path lines
  |     |-- AnalyticsOverlay    Real-time joint data HUD
  |     |-- SimControls.tsx     Toolbar (solve, play, speed, toggles)
  |     |-- RightPanel.tsx      Joint inspector, waypoint list
  |     |-- BottomPanel.tsx     Timeline, DH table, keyframes
  |     |-- DHTable.tsx         Editable DH parameter table
  |
  |-- Hooks
        |-- useIK.ts            Auto-IK trigger on target change
        |-- useSimulation.ts    rAF loops for IK/timeline/path anim
```

---

## Kinematic Model

### Denavit-Hartenberg Convention

Every joint is parameterized by the four standard DH parameters:

| Symbol | Parameter | Description |
|--------|-----------|-------------|
| theta  | Joint angle | Rotation about the local z-axis (radians). Primary variable for revolute joints. |
| d      | Link offset | Translation along the local z-axis. Primary variable for prismatic joints. |
| a      | Link length | Translation along the local x-axis after the z-rotation. |
| alpha  | Link twist  | Rotation about the local x-axis (radians). Defines the angular offset between consecutive z-axes. |

The homogeneous transform for a single joint frame is computed as:

```
T = Rot_z(theta) * Trans_z(d) * Trans_x(a) * Rot_x(alpha)
```

Expanded into a 4x4 matrix:

```
| cos(theta)  -sin(theta)*cos(alpha)   sin(theta)*sin(alpha)  a*cos(theta) |
| sin(theta)   cos(theta)*cos(alpha)  -cos(theta)*sin(alpha)  a*sin(theta) |
|     0             sin(alpha)              cos(alpha)              d       |
|     0                 0                       0                   1       |
```

This is implemented in `kinematics.ts:dhTransform()`. The function constructs a `THREE.Matrix4` directly from the trigonometric components, avoiding intermediate matrix multiplications.

### Forward Kinematics

`computeAllTransforms()` chains the DH transforms sequentially. Starting from an identity matrix (optionally translated by the base position), it multiplies each joint's transform left-to-right:

```
T_world(i) = T_base * T_1 * T_2 * ... * T_i
```

The function returns an array of cumulative world-space `Matrix4` instances, one per joint. The final entry is the end-effector frame. Position extraction is done via `positionFromMatrix()` which reads elements [12], [13], [14] from the column-major Matrix4.

### Inverse Kinematics

The IK solver uses a **damped Jacobian pseudoinverse** method for position-only solving (3-DOF task space). The algorithm:

1. Compute the current end-effector position via FK.
2. Calculate the positional error vector: `e = target - current`.
3. If `||e|| < tolerance`, return converged.
4. Numerically approximate the 3xN Jacobian via finite differences (delta = 0.001). For each actuated joint, perturb by delta, recompute FK, and measure the position change.
5. Compute the damped pseudoinverse: `J_pinv = J^T * (J * J^T + lambda^2 * I)^(-1)`. The damping factor lambda (default 0.01) prevents singularity blow-up near kinematic singularities.
6. Compute joint updates: `dq = J_pinv * e`.
7. Apply updates with joint limit clamping.
8. Repeat up to `maxIter` (default 100) iterations.

The 3x3 matrix inversion for `(J * J^T + lambda^2 * I)` is done analytically using the cofactor expansion formula, which is faster than a general-purpose solver for this fixed-size case.

Joint limits are enforced per-iteration by clamping revolute angles to `[thetaMin, thetaMax]` and prismatic extensions to `[dMin, dMax]`.

---

## Joint Types

| Type | DOF | Control Variable | Visual |
|------|-----|-----------------|--------|
| **Base** | 0 | None (anchor) | Hexagonal platform |
| **Revolute** | 1 | theta (rotation about z) | Torus ring indicating rotation plane |
| **Prismatic** | 1 | d (translation along z) | Cylinder with extension indicator |
| **Elbow** | 2 | theta + theta2 (two orthogonal axes) | Dual-ring mesh showing both rotation planes |
| **End-Effector** | 0 | None (passive tip) | Sphere at terminal position |

The elbow joint is internally decomposed into two sequential DH transforms. The first uses `(theta, d, 0, alpha)` and the second uses `(theta2, 0, a, 0)`, giving two orthogonal rotation axes. This is equivalent to a universal joint and contributes 2 DOF to the kinematic chain.

Default DH parameters, joint limits, and display metadata (icons, colors, descriptions) are defined in `jointDefaults.ts`.

---

## Constraint System

Two runtime constraints prevent physically invalid configurations:

**Floor constraint**: No joint position may have a y-coordinate below `FLOOR_Y` (0.0). Checked by extracting world positions from all cumulative transforms and verifying `y >= 0` for each.

**Self-collision**: Non-adjacent link segments must maintain a minimum distance of `COLLISION_MARGIN` (0.08 units). Collision is checked via closest-distance computation between all pairs of non-adjacent line segments (segment-segment distance using parametric clamping).

Constraints are enforced at multiple levels:
- The `updateJoint` store action rejects parameter patches that would cause violations.
- The `setBasePosition` action clamps y to `FLOOR_Y` and rejects positions causing violations.
- The IK target is clamped to `y >= FLOOR_Y` during drag.
- Visual feedback: arm links and trace color switch to red when any constraint is violated.

---

## Multi-Waypoint Pathfinding

Users can define an ordered sequence of waypoints (target positions in 3D space). The path solver (`solveWaypointPath`) processes them as follows:

1. Capture the current joint pose as the starting configuration.
2. For each consecutive pair of waypoints (or start-to-first-waypoint), subdivide the straight-line Cartesian segment into N intermediate targets (default N=10).
3. For each sub-target, solve IK starting from the previous solution. This forces the end-effector to track the Cartesian straight line between waypoints rather than taking curved shortcuts through joint space.
4. Store all intermediate poses and end-effector positions.

This Cartesian subdivision strategy is critical. Naive linear interpolation in joint space between waypoint solutions causes the end-effector to trace curved paths that can miss intermediate waypoints entirely. By solving IK for densely spaced Cartesian targets, the end-effector path closely approximates the desired straight-line trajectory.

The resulting pose sequence is played back via `tickPath()`, which interpolates between consecutive stored poses using the `animSpeed` multiplier. A scrubber allows manual stepping through the path.

---

## Animation Pipeline

Three independent animation systems run via `requestAnimationFrame` loops managed in `useSimulation.ts`:

**IK Animation**: Interpolates between a start pose and an IK-solved end pose using a cubic ease-in-out curve: `t < 0.5 ? 4t^3 : 1 - (-2t + 2)^3 / 2`. Duration scales inversely with `animSpeed`.

**Timeline Playback**: Keyframe-based animation. Users record poses at specific time points. Playback interpolates between keyframes using linear blending of joint parameters. The `poseAtKeyframeTime()` function finds the bounding keyframes and computes the blend factor.

**Path Animation**: Steps through the pre-solved waypoint pose sequence. Each tick advances `pathAnimProgress` by `dt * animSpeed`, with the integer part selecting the pose segment and the fractional part used for inter-pose blending.

All three systems record end-effector trace points during playback, building a green trail line capped at 600 samples (oldest discarded via ring buffer).

---

## State Management

The Zustand store (`store.ts`) is the single source of truth. Key state groups:

- **Arm configuration**: `joints[]`, `basePosition`, `selectedJointId`
- **IK state**: `ikTarget`, `ikResult`, `autoIK`
- **Pose animation**: `animState`, `animStartPose`, `animEndPose`, `animProgress`
- **Timeline**: `keyframes[]`, `simulationState`, `playbackTime`
- **Waypoints**: `waypoints[]`, `waypointPoses[]`, `waypointEEPath[]`, `pathAnimState`, `pathAnimProgress`
- **Visualization**: `eeTrace[]`, `showTrace`, `showAnalytics`, `showPathLine`
- **Playback settings**: `animSpeed`, `animLoop`
- **Undo**: `undoStack` (last 20 joint configurations)

Poses are stored as `Record<string, number>` dictionaries mapping joint IDs to their control variable values. Elbow joints use composite keys (`id:t1`, `id:t2`) to store both rotation axes. Pose blending is done per-key with linear interpolation.

---

## Presets

Five built-in arm configurations:

| Preset | Chain | Notes |
|--------|-------|-------|
| Simple 2-Joint | base, revolute, revolute, end-effector | Minimal planar arm |
| 3-Joint Arm | base, revolute, elbow, end-effector | 3-DOF with elbow providing 2 axes |
| 6-DOF Spherical | base, revolute (waist), elbow, revolute (wrist), end-effector | Full 3D reach with base turntable |
| Pick and Place | base, revolute, elbow, prismatic, end-effector | Elbow arm with telescoping gripper |
| Telescoping | base, revolute, prismatic, revolute, end-effector | Extensible reach |

All presets initialize with the first revolute joint at `theta = pi/2`, producing an upright starting pose where the first link extends vertically from the base. The 6-DOF Spherical preset additionally configures the first revolute as a turntable (waist) with `alpha = -pi/2` to orient the z-axis upward, enabling full spherical workspace coverage.

---

## Project Structure

```
robot-arm-sandbox/
  src/
    lib/
      kinematics.ts       DH transforms, FK, IK solver, constraints
      store.ts            Zustand store with all state and actions
      jointDefaults.ts    Default DH params, metadata per joint type
      viewportRef.ts      Camera/canvas ref bridge for screen-to-world
    components/
      Viewport.tsx        R3F canvas, scene graph, floor, grid
      JointMesh.tsx       3D joint visualization with pointer drag
      SnapConnector.tsx   Visual connectors between joints
      SimControls.tsx     Top toolbar (solve, animate, speed, toggles)
      RightPanel.tsx      Joint parameter inspector, waypoint manager
      BottomPanel.tsx     Timeline controls, DH table, keyframe editor
      DHTable.tsx         Tabular DH parameter display/edit
      WaypointMarkers.tsx Draggable 3D waypoint spheres with labels
      PathVisualization.tsx  EE trace trail + planned path line
      AnalyticsOverlay.tsx   Real-time joint angles, positions, distances
    hooks/
      useIK.ts            Auto-solve trigger on target/joint changes
      useSimulation.ts    rAF animation loops for all playback modes
    styles/
      globals.css         Layout grid, panel styles, CSS variables
    App.tsx               Root layout, keyboard shortcuts
    main.tsx              React DOM entry point
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

---

## Getting Started

Prerequisites: Node.js >= 18.

```bash
cd robot-arm-sandbox
npm install
npm run dev
```

The development server starts on `http://localhost:5173` (or next available port). Hot module replacement is enabled via Vite.

### Controls

- **Left panel**: Select a preset or drag joint types onto the viewport to build a custom arm.
- **Viewport**: Orbit (left drag), pan (right drag), zoom (scroll). Click joints to select. Drag joints to reposition. Drag the red sphere to move the IK target.
- **Shift+Click** on the floor plane to place waypoints.
- **Right panel**: Edit DH parameters for the selected joint. Manage waypoints. Scrub through path animation.
- **Bottom panel**: Record keyframes, manage timeline playback, view the DH table.
- **Keyboard**: Ctrl/Cmd+Z to undo. Delete/Backspace to remove selected joint.

### Build

```bash
npm run build
```

Outputs to `dist/`. Static files suitable for any HTTP server.

---

## Tech Stack

| Library | Role |
|---------|------|
| React 19 | UI framework |
| Three.js 0.183 | 3D rendering engine |
| React Three Fiber 9 | React renderer for Three.js |
| Drei | R3F helpers (OrbitControls, Grid, GizmoHelper, Line, Html, Environment) |
| Zustand 5 | State management |
| Vite 8 | Build tool and dev server |
| TypeScript 5.9 | Type system |
