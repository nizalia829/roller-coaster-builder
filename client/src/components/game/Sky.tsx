import { useMemo } from "react";
import { useRollerCoaster } from "@/lib/stores/useRollerCoaster";

export function Sky() {
  const { isNightMode } = useRollerCoaster();
  
  const parkLights = useMemo(() => {
    const lights: { x: number; z: number; height: number; color: string }[] = [];
    
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 80 + Math.random() * 100;
      lights.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        height: 8 + Math.random() * 4,
        color: ["#FFD700", "#FF6B6B", "#4ECDC4", "#FF69B4", "#00CED1"][Math.floor(Math.random() * 5)]
      });
    }
    return lights;
  }, []);
  
  const ferrisWheel = useMemo(() => {
    const spokes: { angle: number; color: string }[] = [];
    for (let i = 0; i < 12; i++) {
      spokes.push({
        angle: (i / 12) * Math.PI * 2,
        color: ["#FF0000", "#FFFF00", "#00FF00", "#0000FF", "#FF00FF", "#00FFFF"][i % 6]
      });
    }
    return spokes;
  }, []);
  
  if (isNightMode) {
    return (
      <>
        <color attach="background" args={["#0a0a1a"]} />
        <fog attach="fog" args={["#0a0a1a", 100, 400]} />
        
        <ambientLight intensity={0.1} color="#4466aa" />
        <directionalLight
          position={[50, 50, 25]}
          intensity={0.2}
          color="#6688cc"
        />
        
        <mesh position={[-60, 35, -80]}>
          <sphereGeometry args={[5, 32, 32]} />
          <meshBasicMaterial color="#FFFFCC" />
        </mesh>
        <pointLight position={[-60, 35, -80]} intensity={0.3} color="#FFFFCC" distance={200} />
        
        {[...Array(100)].map((_, i) => (
          <mesh key={i} position={[
            (Math.random() - 0.5) * 400,
            50 + Math.random() * 50,
            (Math.random() - 0.5) * 400
          ]}>
            <sphereGeometry args={[0.1 + Math.random() * 0.1, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        ))}
        
        {parkLights.map((light, i) => (
          <group key={`post-${i}`} position={[light.x, 0, light.z]}>
            <mesh position={[0, light.height / 2, 0]}>
              <cylinderGeometry args={[0.15, 0.2, light.height, 8]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
            <mesh position={[0, light.height + 0.5, 0]}>
              <sphereGeometry args={[0.4, 16, 16]} />
              <meshBasicMaterial color={light.color} />
            </mesh>
            <pointLight 
              position={[0, light.height + 0.5, 0]} 
              intensity={0.5} 
              color={light.color} 
              distance={20} 
            />
          </group>
        ))}
        
        <group position={[120, 0, -100]}>
          <mesh position={[0, 20, 0]}>
            <cylinderGeometry args={[0.8, 1, 40, 8]} />
            <meshStandardMaterial color="#444444" />
          </mesh>
          
          <mesh position={[0, 25, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[15, 0.3, 8, 32]} />
            <meshBasicMaterial color="#FF00FF" />
          </mesh>
          
          {ferrisWheel.map((spoke, i) => (
            <group key={i}>
              <mesh 
                position={[
                  Math.cos(spoke.angle) * 15,
                  25 + Math.sin(spoke.angle) * 15,
                  0
                ]}
              >
                <boxGeometry args={[2, 2, 2]} />
                <meshBasicMaterial color={spoke.color} />
              </mesh>
              <pointLight 
                position={[
                  Math.cos(spoke.angle) * 15,
                  25 + Math.sin(spoke.angle) * 15,
                  0
                ]}
                intensity={0.3}
                color={spoke.color}
                distance={10}
              />
            </group>
          ))}
        </group>
        
        <group position={[-100, 0, 80]}>
          <mesh position={[0, 30, 0]}>
            <cylinderGeometry args={[3, 5, 60, 12]} />
            <meshStandardMaterial color="#333366" />
          </mesh>
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[0, 5 + i * 7, 0]}>
              <torusGeometry args={[6, 0.2, 8, 32]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#FF0000" : "#FFFF00"} />
            </mesh>
          ))}
          <pointLight position={[0, 60, 0]} intensity={1} color="#FF4444" distance={30} />
        </group>
        
        <group position={[80, 0, 100]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[8, 10, 6, 16]} />
            <meshStandardMaterial color="#663399" />
          </mesh>
          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return (
              <group key={i}>
                <mesh position={[Math.cos(angle) * 7, 4, Math.sin(angle) * 7]}>
                  <boxGeometry args={[1.5, 2, 1]} />
                  <meshBasicMaterial color={["#FF0000", "#00FF00", "#0000FF", "#FFFF00"][i % 4]} />
                </mesh>
                <pointLight 
                  position={[Math.cos(angle) * 7, 5, Math.sin(angle) * 7]}
                  intensity={0.2}
                  color={["#FF0000", "#00FF00", "#0000FF", "#FFFF00"][i % 4]}
                  distance={8}
                />
              </group>
            );
          })}
        </group>
      </>
    );
  }
  
  return (
    <>
      <color attach="background" args={["#87CEEB"]} />
      <fog attach="fog" args={["#87CEEB", 100, 400]} />
      
      <mesh position={[50, 40, -50]}>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#FFFF88" />
      </mesh>
      
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <hemisphereLight args={["#87CEEB", "#228B22", 0.3]} />
    </>
  );
}
