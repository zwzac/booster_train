keyframes = [
        # Resting pose: arms down by the sides, slight elbow bend.
        Keyframe(
            t=0.0,
            joint_values={
                "Left_Elbow_Yaw": 0.0,
                "Right_Elbow_Yaw": 0.0,
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
            },
        ),
        # Curl both elbows up (bicep curl).
        Keyframe(
            t=0.8,
            joint_values={
                "Left_Elbow_Yaw": -2.0,
                "Right_Elbow_Yaw": 2.0,
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
            },
        ),
        # Hold at the top.
        Keyframe(
            t=1.4,
            joint_values={
                "Left_Elbow_Yaw": -2.0,
                "Right_Elbow_Yaw": 2.0,
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
            },
        ),
        # Return to rest.
        Keyframe(
            t=2.0,
            joint_values={
                "Left_Elbow_Yaw": 0.0,
                "Right_Elbow_Yaw": 0.0,
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
            },
        ),
    ]
