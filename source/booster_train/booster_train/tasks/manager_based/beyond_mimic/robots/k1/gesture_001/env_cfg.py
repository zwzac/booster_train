import os
from pathlib import Path

from isaaclab.utils import configclass
from booster_train.assets.robots.booster import BOOSTER_K1_CFG as ROBOT_CFG, K1_ACTION_SCALE
from booster_train.tasks.manager_based.beyond_mimic.robots.k1.fight_001.tracking_env_cfg import TrackingEnvCfg


def _find_motion_file() -> str:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "innobridge" / "npz" / "gesture.npz"
        if candidate.exists():
            return str(candidate)
    return os.path.abspath(os.path.join("innobridge", "npz", "gesture.npz"))


MOTION_FILE = _find_motion_file()


@configclass
class FlatEnvCfg(TrackingEnvCfg):
    def __post_init__(self):
        super().__post_init__()

        self.scene.robot = ROBOT_CFG.replace(prim_path="{ENV_REGEX_NS}/Robot")
        self.actions.joint_pos.scale = K1_ACTION_SCALE
        self.commands.motion.motion_file = MOTION_FILE
        self.commands.motion.anchor_body_name = "Trunk"
        self.commands.motion.body_names = [
            "Trunk",
            "Head_2",
            "Left_Hip_Roll",
            "Left_Shank",
            "left_foot_link",
            "Right_Hip_Roll",
            "Right_Shank",
            "right_foot_link",
            "Left_Arm_2",
            "Left_Arm_3",
            "left_hand_link",
            "Right_Arm_2",
            "Right_Arm_3",
            "right_hand_link",
        ]


@configclass
class FlatWoStateEstimationEnvCfg(FlatEnvCfg):
    def __post_init__(self):
        super().__post_init__()
        self.observations.policy.motion_anchor_pos_b = None
        self.observations.policy.base_lin_vel = None


@configclass
class RoughWoStateEstimationEnvCfg(FlatWoStateEstimationEnvCfg):
    def __post_init__(self):
        super().__post_init__()
        self.scene.terrain.terrain_type = "plane"


@configclass
class PlayFlatWoStateEstimationEnvCfg(FlatWoStateEstimationEnvCfg):
    def __post_init__(self):
        super().__post_init__()
        self.commands.motion.play = True
        self.events.push_robot = None
