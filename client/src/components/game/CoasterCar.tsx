import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRollerCoaster, LoopSegment } from "@/lib/stores/useRollerCoaster";
import { getTrackCurve } from "./Track";

interface TrackSection {
  type: "spline" | "loop";
  startProgress: number;
  endProgress: number;
  arcLength: number;
  loopFrame?: LoopFrame;
  splineStartT?: number;
  splineEndT?: number;
}

interface LoopFrame {
  entryPos: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  radius: number;
}

function sampleLoopAnalytically(
  frame: LoopFrame,
  theta: number
): { point: THREE.Vector3; tangent: THREE.Vector3; up: THREE.Vector3 } {
  const { entryPos, forward, up, radius } = frame;
  
  const point = new THREE.Vector3(
    entryPos.x + forward.x * Math.sin(theta) * radius + up.x * (1 - Math.cos(theta)) * radius,
    entryPos.y + forward.y * Math.sin(theta) * radius + up.y * (1 - Math.cos(theta)) * radius,
    entryPos.z + forward.z * Math.sin(theta) * radius + up.z * (1 - Math.cos(theta)) * radius
  );
  
  const tangent = new THREE.Vector3()
    .addScaledVector(forward, Math.cos(theta))
    .addScaledVector(up, Math.sin(theta))
    .normalize();
  
  const inwardUp = new THREE.Vector3()
    .addScaledVector(forward, -Math.sin(theta))
    .addScaledVector(up, Math.cos(theta))
    .normalize();
  
  return { point, tangent, up: inwardUp };
}

function computeLoopFrame(
  spline: THREE.CatmullRomCurve3,
  splineT: number,
  prevTangent: THREE.Vector3,
  prevUp: THREE.Vector3,
  radius: number
): LoopFrame {
  const entryPos = spline.getPoint(splineT);
  const forward = spline.getTangent(splineT).normalize();
  
  const dot = Math.max(-1, Math.min(1, prevTangent.dot(forward)));
  let entryUp: THREE.Vector3;
  if (dot > 0.9999) {
    entryUp = prevUp.clone();
  } else if (dot < -0.9999) {
    entryUp = prevUp.clone();
  } else {
    const axis = new THREE.Vector3().crossVectors(prevTangent, forward);
    if (axis.length() > 0.0001) {
      axis.normalize();
      const angle = Math.acos(dot);
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      entryUp = prevUp.clone().applyQuaternion(quat);
    } else {
      entryUp = prevUp.clone();
    }
  }
  
  const upDot = entryUp.dot(forward);
  entryUp.sub(forward.clone().multiplyScalar(upDot));
  if (entryUp.length() > 0.001) {
    entryUp.normalize();
  } else {
    entryUp.set(0, 1, 0);
    const d = entryUp.dot(forward);
    entryUp.sub(forward.clone().multiplyScalar(d)).normalize();
  }
  
  const right = new THREE.Vector3().crossVectors(forward, entryUp).normalize();
  
  return { entryPos, forward, up: entryUp, right, radius };
}

function sampleHybridTrack(
  progress: number,
  sections: TrackSection[],
  spline: THREE.CatmullRomCurve3
): { point: THREE.Vector3; tangent: THREE.Vector3; up: THREE.Vector3 } | null {
  if (sections.length === 0) return null;
  
  progress = Math.max(0, Math.min(progress, 0.9999));
  
  let section: TrackSection | null = null;
  for (const s of sections) {
    if (progress >= s.startProgress && progress < s.endProgress) {
      section = s;
      break;
    }
  }
  
  if (!section) {
    section = sections[sections.length - 1];
  }
  
  const localT = (progress - section.startProgress) / (section.endProgress - section.startProgress);
  
  if (section.type === "loop" && section.loopFrame) {
    const theta = localT * Math.PI * 2;
    return sampleLoopAnalytically(section.loopFrame, theta);
  } else if (section.splineStartT !== undefined && section.splineEndT !== undefined) {
    const splineT = section.splineStartT + localT * (section.splineEndT - section.splineStartT);
    const point = spline.getPoint(splineT);
    const tangent = spline.getTangent(splineT).normalize();
    
    let up = new THREE.Vector3(0, 1, 0);
    const dot = up.dot(tangent);
    up.sub(tangent.clone().multiplyScalar(dot));
    if (up.lengthSq() > 0.001) {
      up.normalize();
    } else {
      up.set(1, 0, 0);
      const d = up.dot(tangent);
      up.sub(tangent.clone().multiplyScalar(d)).normalize();
    }
    
    return { point, tangent, up };
  }
  
  return null;
}

export function CoasterCar() {
  const meshRef = useRef<THREE.Group>(null);
  const { trackPoints, loopSegments, rideProgress, isRiding, mode, isLooped } = useRollerCoaster();
  
  const sections = useMemo(() => {
    if (trackPoints.length < 2) return [];
    
    const curve = getTrackCurve(trackPoints, isLooped);
    if (!curve) return [];
    
    const loopMap = new Map<string, LoopSegment>();
    for (const seg of loopSegments) {
      loopMap.set(seg.entryPointId, seg);
    }
    
    const numPoints = trackPoints.length;
    const totalSplineSegments = isLooped ? numPoints : numPoints - 1;
    const sections: TrackSection[] = [];
    let accumulatedLength = 0;
    
    let prevTangent = curve.getTangent(0).normalize();
    let prevUp = new THREE.Vector3(0, 1, 0);
    const initDot = prevUp.dot(prevTangent);
    prevUp.sub(prevTangent.clone().multiplyScalar(initDot));
    if (prevUp.length() < 0.01) {
      prevUp.set(1, 0, 0);
      const d = prevUp.dot(prevTangent);
      prevUp.sub(prevTangent.clone().multiplyScalar(d));
    }
    prevUp.normalize();
    
    for (let i = 0; i < numPoints; i++) {
      const point = trackPoints[i];
      const loopSeg = loopMap.get(point.id);
      
      if (loopSeg) {
        const splineT = i / totalSplineSegments;
        const loopFrame = computeLoopFrame(curve, splineT, prevTangent, prevUp, loopSeg.radius);
        const loopArcLength = 2 * Math.PI * loopSeg.radius;
        
        sections.push({
          type: "loop",
          startProgress: 0,
          endProgress: 0,
          arcLength: loopArcLength,
          loopFrame,
        });
        accumulatedLength += loopArcLength;
        
        const exitSample = sampleLoopAnalytically(loopFrame, Math.PI * 2);
        prevTangent.copy(exitSample.tangent);
        prevUp.copy(exitSample.up);
      }
      
      if (i >= numPoints - 1 && !isLooped) continue;
      
      const splineStartT = i / totalSplineSegments;
      const splineEndT = (i + 1) / totalSplineSegments;
      
      let segmentLength = 0;
      const subSamples = 10;
      for (let s = 0; s < subSamples; s++) {
        const t1 = splineStartT + (s / subSamples) * (splineEndT - splineStartT);
        const t2 = splineStartT + ((s + 1) / subSamples) * (splineEndT - splineStartT);
        const p1 = curve.getPoint(t1);
        const p2 = curve.getPoint(t2);
        segmentLength += p1.distanceTo(p2);
      }
      
      sections.push({
        type: "spline",
        startProgress: 0,
        endProgress: 0,
        arcLength: segmentLength,
        splineStartT,
        splineEndT,
      });
      accumulatedLength += segmentLength;
      
      const endTangent = curve.getTangent(splineEndT).normalize();
      const dot = Math.max(-1, Math.min(1, prevTangent.dot(endTangent)));
      if (dot < 0.9999 && dot > -0.9999) {
        const axis = new THREE.Vector3().crossVectors(prevTangent, endTangent);
        if (axis.length() > 0.0001) {
          axis.normalize();
          const angle = Math.acos(dot);
          const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
          prevUp.applyQuaternion(quat);
        }
      }
      const upDot = prevUp.dot(endTangent);
      prevUp.sub(endTangent.clone().multiplyScalar(upDot));
      if (prevUp.length() > 0.001) prevUp.normalize();
      prevTangent.copy(endTangent);
    }
    
    let runningLength = 0;
    for (const section of sections) {
      section.startProgress = runningLength / accumulatedLength;
      runningLength += section.arcLength;
      section.endProgress = runningLength / accumulatedLength;
    }
    
    return sections;
  }, [trackPoints, loopSegments, isLooped]);
  
  useFrame(() => {
    if (!meshRef.current || !isRiding) return;
    
    const curve = getTrackCurve(trackPoints, isLooped);
    if (!curve || sections.length === 0) return;
    
    const sample = sampleHybridTrack(rideProgress, sections, curve);
    if (!sample) return;
    
    const { point: position, tangent, up } = sample;
    
    meshRef.current.position.copy(position);
    meshRef.current.position.addScaledVector(up, -0.3);
    
    const angle = Math.atan2(tangent.x, tangent.z);
    meshRef.current.rotation.y = angle;
    
    const pitch = Math.asin(-tangent.y);
    meshRef.current.rotation.x = pitch;
    
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const roll = Math.atan2(right.y, up.y);
    meshRef.current.rotation.z = roll;
  });
  
  if (!isRiding || mode !== "ride") return null;
  
  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 0.5, 2]} />
        <meshStandardMaterial color="#ff0000" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, -0.5]}>
        <boxGeometry args={[0.8, 0.3, 0.6]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[-0.5, -0.35, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} />
      </mesh>
      <mesh position={[0.5, -0.35, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} />
      </mesh>
      <mesh position={[-0.5, -0.35, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} />
      </mesh>
      <mesh position={[0.5, -0.35, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} />
      </mesh>
    </group>
  );
}
