import { Environment, Lightformer, Sky } from '@react-three/drei';
import { PALETTE, QUALITY, type QualityTier } from './scene-config';

interface Props {
  tier: QualityTier;
  mode: 'drive' | 'inspect';
}

/**
 * Dawn/dusk cinematic lighting — fully procedural so it runs offline with no
 * HDRI file. Image-based reflections come from baked <Lightformer>s; a low warm
 * sun casts the long shadows; <Sky> + fog give the horizon and depth.
 *
 * To use a real HDRI later, swap the <Environment> children for
 * `<Environment files="/hdri/dusk_1k.hdr" />` — nothing else changes.
 */
export function LightsEnvironment({ tier, mode }: Props) {
  const q = QUALITY[tier];
  const fogDensity = mode === 'inspect' ? 0.014 : 0.022;

  return (
    <>
      {/* Atmosphere */}
      <color attach="background" args={['#10151f']} />
      <fogExp2 attach="fog" args={['#1b2433', fogDensity]} />
      <Sky
        distance={4500}
        sunPosition={[-40, 6, -80]}
        inclination={0.49}
        azimuth={0.25}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.02}
        mieDirectionalG={0.9}
      />

      {/* Image-based lighting (baked once) */}
      <Environment resolution={q.envResolution} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color={PALETTE.sun}
          position={[-7, 3, -7]}
          scale={[12, 7, 1]}
          rotation-y={Math.PI / 4}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color={PALETTE.skyTop}
          position={[0, 9, 2]}
          scale={[16, 16, 1]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          color={PALETTE.skyHaze}
          position={[8, 1.5, -9]}
          scale={[9, 9, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#243049"
          position={[0, -3, 0]}
          scale={[20, 20, 1]}
          rotation-x={-Math.PI / 2}
        />
      </Environment>

      {/* Realistic bounce fill */}
      <hemisphereLight args={[PALETTE.skyHaze, '#1a2233', 0.45]} />
      <ambientLight intensity={0.12} />

      {/* Low warm sun — the only shadow caster */}
      <directionalLight
        position={[-9, 6.5, -3.5]}
        intensity={2.4}
        color={PALETTE.sun}
        castShadow={q.dirShadows}
        shadow-mapSize={[q.shadowMapSize, q.shadowMapSize]}
        shadow-bias={-0.00045}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
    </>
  );
}

export default LightsEnvironment;
