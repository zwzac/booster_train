keyframes = [
        # Resting pose: arms down by the sides.
        Keyframe(
            t=0.0,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "Right_Elbow_Yaw": 0.0,
                "Left_Elbow_Yaw": 0.0,
                "ARight_Shoulder_Pitch": 0.0,
                "ALeft_Shoulder_Pitch": 0.0,
                "Right_Elbow_Pitch": 0.0,
                "Left_Elbow_Pitch": 0.0,
            },
        ),
        # Lift forearms slightly forward to a conversational pose.
        Keyframe(
            t=0.6,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "ARight_Shoulder_Pitch": -0.4,
                "ALeft_Shoulder_Pitch": -0.4,
                "Right_Elbow_Pitch": 0.0,
                "Left_Elbow_Pitch": 0.0,
            },
        ),
        # Bring hands together (inward rotation).
        Keyframe(
            t=1.0,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "Right_Elbow_Yaw": 1.2,
                "Left_Elbow_Yaw": -1.2,
            },
        ),
        # Emphasize with the right hand outward.
        Keyframe(
            t=1.4,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "Right_Elbow_Yaw": 1.8,
                "Left_Elbow_Yaw": -0.6,
                "ARight_Shoulder_Pitch": -0.5,
                "ALeft_Shoulder_Pitch": -0.3,
            },
        ),
        # Return hands together.
        Keyframe(
            t=1.8,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "Right_Elbow_Yaw": 1.2,
                "Left_Elbow_Yaw": -1.2,
            },
        ),
        # Lower back to rest.
        Keyframe(
            t=2.2,
            joint_values={
                "Right_Shoulder_Roll": 1.5,
                "Left_Shoulder_Roll": -1.5,
                "Right_Elbow_Yaw": 0.0,
                "Left_Elbow_Yaw": 0.0,
                "ARight_Shoulder_Pitch": 0.0,
                "ALeft_Shoulder_Pitch": 0.0,
                "Right_Elbow_Pitch": 0.0,
                "Left_Elbow_Pitch": 0.0,
            },
        ),
    ]