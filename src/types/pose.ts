import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface ArmLandmarks {
  leftShoulder: NormalizedLandmark;
  rightShoulder: NormalizedLandmark;
  leftElbow: NormalizedLandmark;
  rightElbow: NormalizedLandmark;
  leftWrist: NormalizedLandmark;
  rightWrist: NormalizedLandmark;
}

// MediaPipe pose landmarker indices for the points we care about
export const LANDMARK_IDX = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;
