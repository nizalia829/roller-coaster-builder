import { create } from "zustand";
import * as THREE from "three";

export type CoasterMode = "build" | "ride" | "preview";

export interface TrackPoint {
  id: string;
  position: THREE.Vector3;
  tilt: number;
}

interface RollerCoasterState {
  mode: CoasterMode;
  trackPoints: TrackPoint[];
  selectedPointId: string | null;
  rideProgress: number;
  isRiding: boolean;
  rideSpeed: number;
  isDraggingPoint: boolean;
  isAddingPoints: boolean;
  isLooped: boolean;
  hasChainLift: boolean;
  showWoodSupports: boolean;
  isNightMode: boolean;
  cameraTarget: THREE.Vector3 | null;
  
  setMode: (mode: CoasterMode) => void;
  setCameraTarget: (target: THREE.Vector3 | null) => void;
  addTrackPoint: (position: THREE.Vector3) => void;
  updateTrackPoint: (id: string, position: THREE.Vector3) => void;
  updateTrackPointTilt: (id: string, tilt: number) => void;
  removeTrackPoint: (id: string) => void;
  createLoopAtPoint: (id: string) => void;
  selectPoint: (id: string | null) => void;
  clearTrack: () => void;
  setRideProgress: (progress: number) => void;
  setIsRiding: (riding: boolean) => void;
  setRideSpeed: (speed: number) => void;
  setIsDraggingPoint: (dragging: boolean) => void;
  setIsAddingPoints: (adding: boolean) => void;
  setIsLooped: (looped: boolean) => void;
  setHasChainLift: (hasChain: boolean) => void;
  setShowWoodSupports: (show: boolean) => void;
  setIsNightMode: (night: boolean) => void;
  startRide: () => void;
  stopRide: () => void;
}

let pointCounter = 0;

export const useRollerCoaster = create<RollerCoasterState>((set, get) => ({
  mode: "build",
  trackPoints: [],
  selectedPointId: null,
  rideProgress: 0,
  isRiding: false,
  rideSpeed: 1.0,
  isDraggingPoint: false,
  isAddingPoints: true,
  isLooped: false,
  hasChainLift: true,
  showWoodSupports: false,
  isNightMode: false,
  cameraTarget: null,
  
  setMode: (mode) => set({ mode }),
  
  setCameraTarget: (target) => set({ cameraTarget: target }),
  
  setIsDraggingPoint: (dragging) => set({ isDraggingPoint: dragging }),
  
  setIsAddingPoints: (adding) => set({ isAddingPoints: adding }),
  
  setIsLooped: (looped) => set({ isLooped: looped }),
  
  setHasChainLift: (hasChain) => set({ hasChainLift: hasChain }),
  
  setShowWoodSupports: (show) => set({ showWoodSupports: show }),
  
  setIsNightMode: (night) => set({ isNightMode: night }),
  
  addTrackPoint: (position) => {
    const id = `point-${++pointCounter}`;
    set((state) => ({
      trackPoints: [...state.trackPoints, { id, position: position.clone(), tilt: 0 }],
    }));
  },
  
  updateTrackPoint: (id, position) => {
    set((state) => ({
      trackPoints: state.trackPoints.map((point) =>
        point.id === id ? { ...point, position: position.clone() } : point
      ),
    }));
  },
  
  updateTrackPointTilt: (id, tilt) => {
    set((state) => ({
      trackPoints: state.trackPoints.map((point) =>
        point.id === id ? { ...point, tilt } : point
      ),
    }));
  },
  
  removeTrackPoint: (id) => {
    set((state) => ({
      trackPoints: state.trackPoints.filter((point) => point.id !== id),
      selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
    }));
  },
  
  createLoopAtPoint: (id) => {
    set((state) => {
      const pointIndex = state.trackPoints.findIndex((p) => p.id === id);
      if (pointIndex === -1) return state;
      
      const basePoint = state.trackPoints[pointIndex];
      const pos = basePoint.position;
      
      // Calculate direction from track
      let direction = new THREE.Vector3(1, 0, 0);
      if (pointIndex > 0) {
        const prevPoint = state.trackPoints[pointIndex - 1];
        direction = pos.clone().sub(prevPoint.position).normalize();
        direction.y = 0;
        if (direction.length() < 0.1) {
          direction = new THREE.Vector3(1, 0, 0);
        } else {
          direction.normalize();
        }
      }
      
      const loopRadius = 10;
      const numLoopPoints = 16;
      const leadInDist = 5;
      const leadOutDist = 8;
      
      // Total forward distance the loop occupies
      const totalLoopLength = leadInDist + (loopRadius * 2) + leadOutDist;
      
      // STEP 1: Shift all subsequent points forward by totalLoopLength
      const shiftedPoints = state.trackPoints.slice(pointIndex + 1).map(p => ({
        ...p,
        position: new THREE.Vector3(
          p.position.x + direction.x * totalLoopLength,
          p.position.y,
          p.position.z + direction.z * totalLoopLength
        )
      }));
      
      // STEP 2: Create loop points in the gap
      const allPoints: TrackPoint[] = [];
      
      // Lead-in: rise toward the loop entrance
      allPoints.push({
        id: `point-${++pointCounter}`,
        position: new THREE.Vector3(
          pos.x + direction.x * 2,
          pos.y + 1,
          pos.z + direction.z * 2
        ),
        tilt: 0
      });
      allPoints.push({
        id: `point-${++pointCounter}`,
        position: new THREE.Vector3(
          pos.x + direction.x * leadInDist,
          pos.y + 2,
          pos.z + direction.z * leadInDist
        ),
        tilt: 0
      });
      
      // Loop center position
      const loopCenterForward = leadInDist + loopRadius;
      const loopCenterX = pos.x + direction.x * loopCenterForward;
      const loopCenterZ = pos.z + direction.z * loopCenterForward;
      const loopCenterY = pos.y + loopRadius;
      
      // Main loop points: entrance at back-bottom, exit at front-bottom
      for (let i = 1; i < numLoopPoints; i++) {
        const angle = -Math.PI / 2 + (i / numLoopPoints) * Math.PI * 2;
        
        const forwardOffset = Math.cos(angle) * loopRadius;
        const heightOffset = Math.sin(angle) * loopRadius;
        
        allPoints.push({
          id: `point-${++pointCounter}`,
          position: new THREE.Vector3(
            loopCenterX + direction.x * forwardOffset,
            loopCenterY + heightOffset,
            loopCenterZ + direction.z * forwardOffset
          ),
          tilt: 0
        });
      }
      
      // Lead-out: descend from loop exit toward the shifted track
      const exitStart = leadInDist + loopRadius * 2;
      allPoints.push({
        id: `point-${++pointCounter}`,
        position: new THREE.Vector3(
          pos.x + direction.x * (exitStart + 2),
          pos.y + 2,
          pos.z + direction.z * (exitStart + 2)
        ),
        tilt: 0
      });
      allPoints.push({
        id: `point-${++pointCounter}`,
        position: new THREE.Vector3(
          pos.x + direction.x * (exitStart + leadOutDist - 2),
          pos.y + 1,
          pos.z + direction.z * (exitStart + leadOutDist - 2)
        ),
        tilt: 0
      });
      allPoints.push({
        id: `point-${++pointCounter}`,
        position: new THREE.Vector3(
          pos.x + direction.x * totalLoopLength,
          pos.y,
          pos.z + direction.z * totalLoopLength
        ),
        tilt: 0
      });
      
      // STEP 3: Combine: before points + loop points + shifted after points
      const newTrackPoints = [
        ...state.trackPoints.slice(0, pointIndex + 1),
        ...allPoints,
        ...shiftedPoints
      ];
      
      return { trackPoints: newTrackPoints };
    });
  },
  
  selectPoint: (id) => set({ selectedPointId: id }),
  
  clearTrack: () => {
    set({ trackPoints: [], selectedPointId: null, rideProgress: 0, isRiding: false });
  },
  
  setRideProgress: (progress) => set({ rideProgress: progress }),
  
  setIsRiding: (riding) => set({ isRiding: riding }),
  
  setRideSpeed: (speed) => set({ rideSpeed: speed }),
  
  startRide: () => {
    const { trackPoints } = get();
    if (trackPoints.length >= 2) {
      set({ mode: "ride", isRiding: true, rideProgress: 0 });
    }
  },
  
  stopRide: () => {
    set({ mode: "build", isRiding: false, rideProgress: 0 });
  },
}));
