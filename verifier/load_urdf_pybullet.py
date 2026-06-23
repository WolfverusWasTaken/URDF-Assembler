from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import pybullet as p
    import pybullet_data
except ImportError as exc:  # pragma: no cover - runtime guard
    print("PyBullet is required. Install it with: pip install pybullet", file=sys.stderr)
    raise SystemExit(1) from exc


SCRIPT_DIR = Path(__file__).resolve().parent
URDF_INPUT_DIR = SCRIPT_DIR / "urdf_input"
RESULTS_DIR = SCRIPT_DIR / "results"


def find_urdf_target(user_path: str | None) -> Path:
    if user_path:
        candidate = Path(user_path).expanduser().resolve()
        if candidate.is_dir():
            urdfs = sorted(candidate.glob("**/*.urdf"))
            if not urdfs:
                raise FileNotFoundError(f"No URDF files found in {candidate}")
            return urdfs[0]
        if candidate.suffix.lower() == ".urdf":
            return candidate
        raise FileNotFoundError(f"Expected a URDF file or folder, got: {candidate}")

    urdfs = sorted(URDF_INPUT_DIR.glob("*.urdf"))
    if not urdfs:
        raise FileNotFoundError(
            f"No URDF files found in {URDF_INPUT_DIR}. Put your robot package or URDF file there first."
        )
    return urdfs[0]


def package_root_for_urdf(urdf_path: Path) -> Path:
    if urdf_path.parent.name.lower() == "urdf":
        return urdf_path.parent.parent
    return urdf_path.parent


def normalize_urdf_paths(urdf_path: Path) -> Path:
    package_root = package_root_for_urdf(urdf_path)
    meshes_dir = package_root / "meshes"

    text = urdf_path.read_text(encoding="utf-8")
    text = re.sub(
        r'package://[^"]+/meshes/',
        f"{meshes_dir.as_posix()}/",
        text,
    )

    normalized_dir = RESULTS_DIR / "normalized"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    normalized_urdf = normalized_dir / urdf_path.name
    normalized_urdf.write_text(text, encoding="utf-8")
    return normalized_urdf


def collect_loaded_body_metrics(robot_id: int):
    num_joints = p.getNumJoints(robot_id)
    aabb_min = [float("inf"), float("inf"), float("inf")]
    aabb_max = [float("-inf"), float("-inf"), float("-inf")]

    bodies = [-1] + list(range(num_joints))
    for link_index in bodies:
        lower, upper = p.getAABB(robot_id, link_index)
        for axis in range(3):
            aabb_min[axis] = min(aabb_min[axis], lower[axis])
            aabb_max[axis] = max(aabb_max[axis], upper[axis])

    return num_joints, aabb_min, aabb_max


def draw_aabb_box(aabb_min, aabb_max, color=(0.15, 0.6, 1.0)):
    x0, y0, z0 = aabb_min
    x1, y1, z1 = aabb_max
    corners = [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
    ]
    edges = [
        (0, 1), (1, 2), (2, 3), (3, 0),
        (4, 5), (5, 6), (6, 7), (7, 4),
        (0, 4), (1, 5), (2, 6), (3, 7),
    ]
    for start_idx, end_idx in edges:
        p.addUserDebugLine(corners[start_idx], corners[end_idx], color, lineWidth=3, lifeTime=0)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load a URDF into a PyBullet environment.")
    parser.add_argument(
        "--urdf",
        default=str(URDF_INPUT_DIR),
        help="Path to a URDF file or a folder containing one. Defaults to verifier/urdf_input.",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        default=True,
        help="Open the PyBullet GUI window. This is the default visual mode.",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run without opening a GUI window.",
    )
    parser.add_argument("--camera-distance", type=float, default=2.0, help="Camera distance from the robot.")
    parser.add_argument("--camera-yaw", type=float, default=45.0, help="Camera yaw in degrees.")
    parser.add_argument("--camera-pitch", type=float, default=-25.0, help="Camera pitch in degrees.")
    parser.add_argument("--z-offset", type=float, default=0.05, help="Lift the robot slightly above the plane.")
    parser.add_argument("--fixed-base", action="store_true", help="Load the robot as a fixed base.")
    args = parser.parse_args()

    urdf_path = find_urdf_target(args.urdf)
    normalized_urdf_path = normalize_urdf_paths(urdf_path)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    connection_mode = p.DIRECT if args.headless else p.GUI
    client_id = p.connect(connection_mode)
    if client_id < 0:
        raise RuntimeError("Failed to connect to PyBullet")

    p.resetSimulation()
    p.setAdditionalSearchPath(pybullet_data.getDataPath())
    p.setGravity(0, 0, -9.81)
    p.loadURDF("plane.urdf")
    p.configureDebugVisualizer(p.COV_ENABLE_GUI, 1)
    p.configureDebugVisualizer(p.COV_ENABLE_SHADOWS, 1)

    base_dir = package_root_for_urdf(urdf_path)
    robot_id = p.loadURDF(
        str(normalized_urdf_path),
        basePosition=[0, 0, args.z_offset],
        useFixedBase=args.fixed_base,
        flags=p.URDF_USE_INERTIA_FROM_FILE,
    )

    num_joints, aabb_min, aabb_max = collect_loaded_body_metrics(robot_id)
    center = [(a + b) * 0.5 for a, b in zip(aabb_min, aabb_max)]
    extents = [max(0.001, abs(b - a)) for a, b in zip(aabb_min, aabb_max)]
    extent = max(extents)
    camera_distance = max(args.camera_distance, extent * 3.0)
    p.resetDebugVisualizerCamera(
        cameraDistance=camera_distance,
        cameraYaw=args.camera_yaw,
        cameraPitch=args.camera_pitch,
        cameraTargetPosition=center,
    )

    axes = [
        ([0, 0, 0], [0.5, 0, 0], [1, 0, 0]),
        ([0, 0, 0], [0, 0.5, 0], [0, 1, 0]),
        ([0, 0, 0], [0, 0, 0.5], [0, 0, 1]),
    ]
    for start, end, color in axes:
        p.addUserDebugLine(start, end, color, lineWidth=3, lifeTime=0)

    print(f"Loaded URDF: {urdf_path}")
    print(f"Normalized URDF: {normalized_urdf_path}")
    print(f"URDF directory: {base_dir}")
    print(f"Robot body id: {robot_id}")
    print(f"Joint count: {num_joints}")
    print(f"AABB min: {aabb_min}")
    print(f"AABB max: {aabb_max}")
    print(f"Camera target: {center}")
    print(f"Camera distance: {camera_distance}")
    print("Running simulation in a visible PyBullet window... press Ctrl+C to exit.")

    p.addUserDebugText(
        f"loaded joints: {num_joints}",
        [center[0], center[1], center[2] + extent * 0.8],
        textColorRGB=[0, 0, 0],
        textSize=1.4,
        lifeTime=0,
    )
    p.addUserDebugText(
        f"robot: {urdf_path.name}",
        [center[0], center[1], center[2] + extent * 0.9],
        textColorRGB=[0.2, 0.2, 0.2],
        textSize=1.2,
        lifeTime=0,
    )
    draw_aabb_box(aabb_min, aabb_max, color=(0.2, 0.5, 1.0))

    try:
        while True:
            p.stepSimulation()
            if connection_mode == p.GUI:
                import time

                time.sleep(1.0 / 240.0)
    except KeyboardInterrupt:
        pass
    finally:
        p.disconnect()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
