"""Generate a simple K1 gesture CSV for csv_to_npz.py.

The CSV row format matches booster_assets retargeted data:
    base_pos (x,y,z), base_quat (x,y,z,w), 22 joint angles (K1_JOINT_NAMES order)
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Iterable

import numpy as np

# Joint order must match booster_assets.motions.K1_JOINT_NAMES
K1_JOINT_NAMES = [
    "AAHead_yaw",
    "Head_pitch",
    "ALeft_Shoulder_Pitch",
    "Left_Shoulder_Roll",
    "Left_Elbow_Pitch",
    "Left_Elbow_Yaw",
    "ARight_Shoulder_Pitch",
    "Right_Shoulder_Roll",
    "Right_Elbow_Pitch",
    "Right_Elbow_Yaw",
    "Left_Hip_Pitch",
    "Left_Hip_Roll",
    "Left_Hip_Yaw",
    "Left_Knee_Pitch",
    "Left_Ankle_Pitch",
    "Left_Ankle_Roll",
    "Right_Hip_Pitch",
    "Right_Hip_Roll",
    "Right_Hip_Yaw",
    "Right_Knee_Pitch",
    "Right_Ankle_Pitch",
    "Right_Ankle_Roll",
]


@dataclass(frozen=True)
class Keyframe:
    t: float
    joint_values: dict[str, float]


def _sample_keyframes(t: float, keyframes: Iterable[Keyframe]) -> dict[str, float]:
    """Linearly interpolate joint values between keyframes."""
    frames = sorted(keyframes, key=lambda k: k.t)
    if not frames:
        return {}
    if t <= frames[0].t:
        return frames[0].joint_values
    if t >= frames[-1].t:
        return frames[-1].joint_values
    for i in range(len(frames) - 1):
        a = frames[i]
        b = frames[i + 1]
        if a.t <= t <= b.t:
            span = max(b.t - a.t, 1e-8)
            u = (t - a.t) / span
            keys = set(a.joint_values) | set(b.joint_values)
            out: dict[str, float] = {}
            for k in keys:
                va = a.joint_values.get(k, 0.0)
                vb = b.joint_values.get(k, 0.0)
                out[k] = (1.0 - u) * va + u * vb
            return out
    return frames[-1].joint_values


def generate_gesture_csv(
    duration_s: float,
    fps: int,
    output_path: str,
    base_pos: tuple[float, float, float],
    base_quat_xyzw: tuple[float, float, float, float],
    keyframes: Iterable[Keyframe],
):
    """Generate a CSV with piecewise-linear joint trajectories.

    Joints not explicitly moved remain at their last value (default 0.0 at t=0).
    """
    dt = 1.0 / fps
    times = np.arange(0.0, duration_s + 1e-9, dt)
    joint_index = {name: i for i, name in enumerate(K1_JOINT_NAMES)}

    joints = np.zeros((len(times), len(K1_JOINT_NAMES)), dtype=np.float32)
    last_values = {name: 0.0 for name in K1_JOINT_NAMES}

    for i, t in enumerate(times):
        values = _sample_keyframes(t, keyframes)
        for name, val in values.items():
            if name not in joint_index:
                raise ValueError(f"Unknown joint name: {name}")
            last_values[name] = val
        for name, idx in joint_index.items():
            joints[i, idx] = last_values[name]

    base_pos_arr = np.tile(np.array(base_pos, dtype=np.float32), (len(times), 1))
    base_quat_arr = np.tile(np.array(base_quat_xyzw, dtype=np.float32), (len(times), 1))
    csv = np.concatenate([base_pos_arr, base_quat_arr, joints], axis=1)
    np.savetxt(output_path, csv, delimiter=",", fmt="%.6f")


def main():
    parser = argparse.ArgumentParser(description="Generate a simple gesture CSV for K1.")
    parser.add_argument("--output", type=str, default="gesture.csv", help="Output CSV path.")
    parser.add_argument("--duration", type=float, default=2.0, help="Gesture duration in seconds.")
    args = parser.parse_args()

    # Base pose (fixed so the robot stays upright)
    base_pos = (0.0, 0.0, 0.57)
    base_quat_xyzw = (0.0, 0.0, 0.0, 1.0)

    # Define keyframes here. Times are in seconds.
    # Joints not listed will stay at their last value.
    keyframes = [
        Keyframe(
            t=0.0,
            joint_values={
                "ALeft_Shoulder_Pitch": 0.0,
                "Left_Shoulder_Roll": 0.0,
                "Left_Elbow_Pitch": 0.0,
                "Left_Elbow_Yaw": 0.0,
                "ARight_Shoulder_Pitch": 0.0,
                "Right_Shoulder_Roll": 0.0,
                "Right_Elbow_Pitch": 0.0,
                "Right_Elbow_Yaw": 0.0,
            },
        ),
        # Raise both arms up (hinge at elbow)
        Keyframe(
            t=0.6,
            joint_values={
                "ALeft_Shoulder_Pitch": 0.5,
                "Left_Elbow_Pitch": 0.9,
                "ARight_Shoulder_Pitch": 0.5,
                "Right_Elbow_Pitch": 0.9,
            },
        ),
        # Move hands together (shoulder roll inward)
        Keyframe(
            t=1.2,
            joint_values={
                "Left_Shoulder_Roll": 0.4,
                "Right_Shoulder_Roll": -0.4,
            },
        ),
        # Move only right arm back out (left stays in)
        Keyframe(
            t=1.8,
            joint_values={
                "Right_Shoulder_Roll": -0.1,
                "Right_Elbow_Pitch": 0.9,
            },
        ),
        # Optional: return to rest at end
        Keyframe(
            t=2.2,
            joint_values={
                "ALeft_Shoulder_Pitch": 0.0,
                "Left_Shoulder_Roll": 0.0,
                "Left_Elbow_Pitch": 0.0,
                "Left_Elbow_Yaw": 0.0,
                "ARight_Shoulder_Pitch": 0.0,
                "Right_Shoulder_Roll": 0.0,
                "Right_Elbow_Pitch": 0.0,
                "Right_Elbow_Yaw": 0.0,
            },
        ),
    ]


    generate_gesture_csv(
        duration_s=args.duration,
        fps=30,
        output_path=args.output,
        base_pos=base_pos,
        base_quat_xyzw=base_quat_xyzw,
        keyframes=keyframes,
    )
    print(f"Wrote: {args.output}")


if __name__ == "__main__":
    main()
