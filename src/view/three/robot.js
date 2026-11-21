/** One delta robot: gantry, base, three motors/arms/forearms and the effector, posed from real inverse kinematics. */
import { THREE, material, addMesh, rod, rodGeometry, toThree } from './three-utils.js';
import { GROUND } from './stage.js';
import { deltaPose } from '../../core/index.js';

const TAU = Math.PI * 2;

export function buildRobot(parent, cfg, robot) {
  const P = cfg.delta, baseY = -P.zPick + cfg.motion.baseGap;       // base height above the belt
  const grp = new THREE.Group(); grp.position.set(robot.x, 0, -robot.y); parent.add(grp);
  const metal = material(0xb9c7bf, { metalness: 0.7, roughness: 0.35 }), dark = material(0x26332d, { roughness: 0.6 });
  const armMat = material(0x2fa36b, { metalness: 0.3 }), foreMat = material(0xdfe9e3, { metalness: 0.5, roughness: 0.3 });
  const span = cfg.belt.width + 1.1;                                // gantry crosses the belt

  addMesh(grp, new THREE.BoxGeometry(0.16, 0.07, span), metal).position.set(0, baseY + 0.09, 0);
  for (const s of [-1, 1]) addMesh(grp, new THREE.BoxGeometry(0.1, baseY + 0.09 - GROUND, 0.1), metal).position.set(0, (baseY + 0.09 + GROUND) / 2, s * span / 2);
  const plateR = P.f / Math.sqrt(3) + 0.07;
  const plate = addMesh(grp, new THREE.CylinderGeometry(plateR, plateR, 0.05, 6), dark); plate.position.set(0, baseY + 0.035, 0);

  const arms = [0, 1, 2].map(() => ({
    motor: addMesh(grp, new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16).rotateZ(Math.PI / 2), dark),
    upper: addMesh(grp, rodGeometry, armMat),
    elbow: addMesh(grp, new THREE.SphereGeometry(0.03, 12, 10), dark),
    fore: [addMesh(grp, rodGeometry, foreMat), addMesh(grp, rodGeometry, foreMat)],     // parallelogram pair
  }));
  const effector = new THREE.Group(); grp.add(effector);
  const ringR = P.e / Math.sqrt(3) + 0.03;
  addMesh(effector, new THREE.CylinderGeometry(ringR, ringR, 0.03, 18), dark);
  const cup = addMesh(effector, new THREE.ConeGeometry(0.035, 0.05, 14), material(0xf4b942)); cup.position.y = -0.045; cup.rotation.x = Math.PI;
  const shaft = addMesh(grp, rodGeometry, material(0x6e7f76, { metalness: 0.8 }));

  const base = new THREE.Vector3(0, baseY, 0), offset = new THREE.Vector3();
  let lastPose = null;

  /** Pose all links for the effector's current position. */
  function update(line, t) {
    const p = line.robotPos(robot, t), ez = line.effectorZ(p);
    const pose = deltaPose(p.x - robot.x, p.y - robot.y, ez, P) || lastPose;
    plate.material.color.set(robot.enabled ? 0x26332d : 0x5a2a20);
    if (!pose) return;
    lastPose = pose;
    const at = q => toThree(q.x, q.y, q.z).add(base);
    pose.forEach((a, k) => {
      const S = at(a.shoulder), E = at(a.elbow), W = at(a.wrist), arm = arms[k], phi = (k * TAU) / 3;
      arm.motor.position.copy(S); arm.motor.rotation.y = -phi;
      rod(arm.upper, S, E, 0.018); arm.elbow.position.copy(E);
      offset.set(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(0.035);
      rod(arm.fore[0], E.clone().add(offset), W.clone().add(offset), 0.009);
      rod(arm.fore[1], E.clone().sub(offset), W.clone().sub(offset), 0.009);
    });
    effector.position.copy(at({ x: p.x - robot.x, y: p.y - robot.y, z: ez }));
    rod(shaft, base, effector.position.clone().add(new THREE.Vector3(0, 0.015, 0)), 0.008);
  }
  /** World height of the effector (m above the belt), used to hang carried items. */
  const effectorHeight = (line, t) => baseY + line.effectorZ(line.robotPos(robot, t));
  return { update, effectorHeight };
}
