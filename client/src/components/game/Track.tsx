import { useMemo } from "react";
import * as THREE from "three";
import { useRollerCoaster } from "@/lib/stores/useRollerCoaster";
import { Line } from "@react-three/drei";

export function Track() {
  const { trackPoints, isLooped, showWoodSupports } = useRollerCoaster();
  
  const { curve, railPoints, woodSupports } = useMemo(() => {
    if (trackPoints.length < 2) {
      return { curve: null, railPoints: [], woodSupports: [] };
    }
    
    const points = trackPoints.map((p) => p.position.clone());
    const curve = new THREE.CatmullRomCurve3(points, isLooped, "catmullrom", 0.5);
    
    const railPoints: THREE.Vector3[] = [];
    const numSamples = Math.max(trackPoints.length * 20, 100);
    
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      railPoints.push(curve.getPoint(t));
    }
    
    const woodSupports: { pos: THREE.Vector3; tangent: THREE.Vector3; height: number }[] = [];
    const supportInterval = 3;
    
    for (let i = 0; i < railPoints.length; i += supportInterval) {
      const point = railPoints[i];
      if (point.y > 1) {
        const t = i / (railPoints.length - 1);
        const tangent = curve.getTangent(Math.min(t, 1));
        woodSupports.push({ 
          pos: point.clone(), 
          tangent: tangent.clone(),
          height: point.y 
        });
      }
    }
    
    return { curve, railPoints, woodSupports };
  }, [trackPoints, isLooped]);
  
  if (!curve || railPoints.length < 2) {
    return null;
  }
  
  const leftRail: [number, number, number][] = [];
  const rightRail: [number, number, number][] = [];
  const railOffset = 0.3;
  
  for (let i = 0; i < railPoints.length; i++) {
    const point = railPoints[i];
    const tangent = curve.getTangent(i / (railPoints.length - 1));
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    leftRail.push([
      point.x + normal.x * railOffset,
      point.y,
      point.z + normal.z * railOffset,
    ]);
    rightRail.push([
      point.x - normal.x * railOffset,
      point.y,
      point.z - normal.z * railOffset,
    ]);
  }
  
  return (
    <group>
      <Line
        points={leftRail}
        color="#ff4444"
        lineWidth={4}
      />
      <Line
        points={rightRail}
        color="#ff4444"
        lineWidth={4}
      />
      
      {railPoints.filter((_, i) => i % 2 === 0).map((point, i) => {
        const t = (i * 2) / (railPoints.length - 1);
        const tangent = curve.getTangent(Math.min(t, 1));
        const angle = Math.atan2(tangent.x, tangent.z);
        
        return (
          <mesh
            key={`tie-${i}`}
            position={[point.x, point.y - 0.08, point.z]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[1.0, 0.08, 0.12]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        );
      })}
      
      {showWoodSupports && woodSupports.map((support, i) => {
        const { pos, tangent, height } = support;
        const angle = Math.atan2(tangent.x, tangent.z);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        const leftX = pos.x + normal.x * railOffset;
        const leftZ = pos.z + normal.z * railOffset;
        const rightX = pos.x - normal.x * railOffset;
        const rightZ = pos.z - normal.z * railOffset;
        
        const legInset = 0.15;
        const leftLegX = pos.x + normal.x * (railOffset - legInset);
        const leftLegZ = pos.z + normal.z * (railOffset - legInset);
        const rightLegX = pos.x - normal.x * (railOffset - legInset);
        const rightLegZ = pos.z - normal.z * (railOffset - legInset);
        
        const crossbraceHeight = height * 0.6;
        const crossLength = Math.sqrt(Math.pow(railOffset * 2, 2) + Math.pow(crossbraceHeight, 2));
        const crossAngle = Math.atan2(crossbraceHeight, railOffset * 2);
        
        return (
          <group key={`wood-${i}`}>
            <mesh position={[leftLegX, height / 2, leftLegZ]}>
              <boxGeometry args={[0.12, height, 0.12]} />
              <meshStandardMaterial color="#8B5A2B" />
            </mesh>
            <mesh position={[rightLegX, height / 2, rightLegZ]}>
              <boxGeometry args={[0.12, height, 0.12]} />
              <meshStandardMaterial color="#8B5A2B" />
            </mesh>
            
            {height > 2 && (
              <>
                <mesh 
                  position={[pos.x, height * 0.3, pos.z]} 
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.08, 0.08, railOffset * 2.2]} />
                  <meshStandardMaterial color="#A0522D" />
                </mesh>
                <mesh 
                  position={[pos.x, height * 0.6, pos.z]} 
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.08, 0.08, railOffset * 2.2]} />
                  <meshStandardMaterial color="#A0522D" />
                </mesh>
              </>
            )}
            
            {height > 3 && (
              <mesh 
                position={[pos.x, height * 0.45, pos.z]} 
                rotation={[crossAngle, angle, 0]}
              >
                <boxGeometry args={[0.06, crossLength * 0.5, 0.06]} />
                <meshStandardMaterial color="#CD853F" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function getTrackCurve(trackPoints: { position: THREE.Vector3 }[], isLooped: boolean = false) {
  if (trackPoints.length < 2) return null;
  const points = trackPoints.map((p) => p.position.clone());
  return new THREE.CatmullRomCurve3(points, isLooped, "catmullrom", 0.5);
}
