//Import necessary modules from Three.js and other resources
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';
import {game} from './game.js';
import {math} from './math.js';
import {visibility} from './visibility.js';
import {OBJLoader} from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/loaders/GLTFLoader.js';

// Initialize GLTFLoader to load 3D models in the GTLF format
const loader = new GLTFLoader(); // Now you can use GLTFLoader

// Variables for boid simulation and general permeters
let _APP = null;

const _NUM_BOIDS = 350; //Number of boids
const _BOID_SPEED = 2.5; //Speed of boids
const _BOID_ACCELERATION = _BOID_SPEED / 5.0; //Acceleration rate of boids
const _BOID_FORCE_MAX = _BOID_ACCELERATION / 10.0; //Maximum steering force
const _BOID_FORCE_ORIGIN = 8; //Force applied to boids to move towards origin
const _BOID_FORCE_ALIGNMENT = 10; //Force for alignment with nearby boids 
const _BOID_FORCE_SEPARATION = 20; //Force to seperate from other boids
const _BOID_FORCE_COHESION = 10; //Force to group with nearby boids
const _BOID_FORCE_WANDER = 3; // Force to make boids wander around

// Class to render lines between boids and other points 
// class LineRenderer {
//   constructor(game) {
//     this._game = game;

//     this._materials = {};
//     this._group = new THREE.Group();

//     this._game._graphics.Scene.add(this._group); //add this group to scene
//   }

//   Reset() {
//     this._lines = [];
//     this._group.remove(...this._group.children); //remove all lines from group
//   }

//   Add(pt1, pt2, hexColour) {
//     const geometry = new THREE.Geometry();
//     geometry.vertices.push(pt1);
//     geometry.vertices.push(pt2);

//     let material = this._materials[hexColour];
//     if (!material) {
//       this._materials[hexColour] = new THREE.LineBasicMaterial(
//           {color: hexColour});
//       material = this._materials[hexColour];
//     }

//     const line = new THREE.Line(geometry, material);
//     this._lines.push(line);
//     this._group.add(line);
//   }
// }

//Boid class for each fish in the simulation 
class Boid {

  constructor(game, params) {
    // Create the boid's mesh with provided geometry and material
    this._mesh = new THREE.Mesh(
      params.geometry, 
      params.material || new THREE.MeshStandardMaterial({ color: params.colour }) // Use material, fallback to color
    );
    this._mesh.castShadow = true;
    this._mesh.receiveShadow = false; 

    this._group = new THREE.Group();
    this._group.add(this._mesh); //Add the mesh to the group 

    // Set random starting position within a certain range 
    this._group.position.set(
      math.rand_range(-50, 50),
      math.rand_range(1, 25),
      math.rand_range(-50, 50)
    );
 
    // Set random direction for the boid
    this._direction = new THREE.Vector3(
        math.rand_range(-1, 1),
        0,
        math.rand_range(-1, 1));
    this._velocity = this._direction.clone();

    // Apply random speed and scaling 
    const speedMultiplier = math.rand_range(params.speedMin, params.speedMax);
    this._maxSteeringForce = params.maxSteeringForce * speedMultiplier;
    this._maxSpeed  = params.speed * speedMultiplier;  
    this._acceleration = params.acceleration * speedMultiplier;  

    const scale = 4.0 / speedMultiplier;
    this._radius = scale;
    this._mesh.scale.setScalar(scale); //Scale the mesh
    this._mesh.rotateX(-Math.PI / 2); //Rotate mesh to face correct direction 

    this._game = game;
    game._graphics.Scene.add(this._group);
 
    // update visibility grid with boids position
    this._visibilityIndex = game._visibilityGrid.UpdateItem(
        this._mesh.uuid, this);

    this._wanderAngle = 0; //Angle for wandering behaviour
  }

  //Display debug information, e.g., a red sphere at the boids position
  DisplayDebug() {
    const geometry = new THREE.SphereGeometry(10, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.25,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this._group.add(mesh);

    this._mesh.material.color.setHex(0xFF0000);
    this._displayDebug = true;
    this._lineRenderer = new LineRenderer(this._game);
  }

  //update debug visuals based on local entities
  _UpdateDebug(local) {
    this._lineRenderer.Reset();
    this._lineRenderer.Add(
        this.Position, this.Position.clone().add(this._velocity),
        0xFFFFFF);
    for (const e of local) {
      this._lineRenderer.Add(this.Position, e.Position, 0x00FF00); //Draw lines to local entities
    }
  }

  get Position() {
    return this._group.position; //Get the position of the boid 
  }

  get Velocity() {
    return this._velocity; //Get velocity of the boid
  }

  get Direction() {
    return this._direction; //Get the direction of the boid
  }

  get Radius() {
    return this._radius; //Get radius (size) of boid
  }

 

  Step(timeInSeconds) { //Main update function for each step of simulation
    if (this._displayDebug) {
      let a = 0;
    }

    const local = this._game._visibilityGrid.GetLocalEntities(
        this.Position, 15);

    this._ApplySteering(timeInSeconds, local);

    //update boids position based on velocity
    const frameVelocity = this._velocity.clone();
    frameVelocity.multiplyScalar(timeInSeconds);
    this._group.position.add(frameVelocity);

       // Define new half-size boundaries
       const boundaryMin = new THREE.Vector3(-50, 1, -100);
       const boundaryMax = new THREE.Vector3( 50, 100, 100);
   
       // Call boundary checking and correction
       this._ApplyBoundaryForce(boundaryMin, boundaryMax);
       
    //update rotation to face movement direction 
    const direction = this.Direction;
    const m = new THREE.Matrix4();
    m.lookAt(
        new THREE.Vector3(0, 0, 0),
        direction,
        new THREE.Vector3(0, 1, 0));
    this._group.quaternion.setFromRotationMatrix(m);

    // update visibility grid for the boids position 
    this._visibilityIndex = this._game._visibilityGrid.UpdateItem(
        this._mesh.uuid, this, this._visibilityIndex);

    //if debugging is enabled, update debug visuals  
    if (this._displayDebug) {
      this._UpdateDebug(local);
    }
  }

    // Method to keep boids within a given boundary
    _ApplyBoundaryForce(boundaryMin, boundaryMax) {
      const correctionForce = new THREE.Vector3();
  
      // Check each axis and apply a force inward if near boundary
      if (this.Position.x < boundaryMin.x) {
        correctionForce.x = (boundaryMin.x - this.Position.x) * 0.1;
      } else if (this.Position.x > boundaryMax.x) {
        correctionForce.x = (boundaryMax.x - this.Position.x) * 0.1;
      }
  
      if (this.Position.y < boundaryMin.y) {
        correctionForce.y = (boundaryMin.y - this.Position.y) * 0.1;
      } else if (this.Position.y > boundaryMax.y) {
        correctionForce.y = (boundaryMax.y - this.Position.y) * 0.1;
      }
  
      if (this.Position.z < boundaryMin.z) {
        correctionForce.z = (boundaryMin.z - this.Position.z) * 0.1;
      } else if (this.Position.z > boundaryMax.z) {
        correctionForce.z = (boundaryMax.z - this.Position.z) * 0.1;
      }
  
      // Apply the correction force to the boid’s velocity
      this._velocity.add(correctionForce);
    }
 
  //Apply various steering behaviours to the boid
  _ApplySteering(timeInSeconds, local) {
    const forces = [
      this._ApplySeek(new THREE.Vector3(0, 10, 0)),
      this._ApplyWander(),
      this._ApplyGroundAvoidance(),
      this._ApplySeparation(local),
    ];

    // If the boid is small enough, apply additional behaviours like alignment and cohesion
    if (this._radius < 5) {
      // Only apply alignment and cohesion to similar sized fish.
      local = local.filter((e) => {
        const ratio = this.Radius / e.Radius;

        return (ratio <= 1.35 && ratio >= 0.75);
      });

      forces.push(
        this._ApplyAlignment(local),
        this._ApplyCohesion(local),
        this._ApplySeparation(local)
      )
    }

    const steeringForce = new THREE.Vector3(0, 0, 0);
    for (const f of forces) {
      steeringForce.add(f);
    } //combine all forces

    //Apply acceleration and clamping of steering force
    steeringForce.multiplyScalar(this._acceleration * timeInSeconds);

    // Preferentially move in x/z dimension
    steeringForce.multiply(new THREE.Vector3(1, 0.25, 1));

    // Clamp the force applied
    if (steeringForce.length() > this._maxSteeringForce) {
      steeringForce.normalize();
      steeringForce.multiplyScalar(this._maxSteeringForce);
    }

    this._velocity.add(steeringForce); //Apply the steering force to the boids velocity

    // Clamp velocity if it exceeds maximum speed
    if (this._velocity.length() > this._maxSpeed) {
      this._velocity.normalize();
      this._velocity.multiplyScalar(this._maxSpeed);
    }

    this._direction = this._velocity.clone();
    this._direction.normalize();
  }

  //Apply different steering behaviour (e.g. seeking the origin, wandering, etc )
  _ApplyGroundAvoidance() {
    const p = this.Position;
    let force = new THREE.Vector3(0, 0, 0);

    if (p.y < 10) {
      force = new THREE.Vector3(0, 10 - p.y, 0);
    } else if (p.y > 30) {
      force = new THREE.Vector3(0, p.y - 50, 0);
    }
    return force.multiplyScalar(_BOID_FORCE_SEPARATION);
  }

  _ApplyWander() { // Apply wander force to simulate random movement

    //randomly adjust the wander angle within a specified range 
    this._wanderAngle += 0.1 * math.rand_range(-2 * Math.PI, 2 * Math.PI);
    //get a random point on a circle using the updated wander angle 
    const randomPointOnCircle = new THREE.Vector3(
        Math.cos(this._wanderAngle),
        0,
        Math.sin(this._wanderAngle));
     //calculate a point ahead based on the boids current direction
    const pointAhead = this._direction.clone();
    pointAhead.multiplyScalar(2);
    pointAhead.add(randomPointOnCircle);
    //Normalize the direction and apply a scaling force
    pointAhead.normalize();
    return pointAhead.multiplyScalar(_BOID_FORCE_WANDER);
  }

  //Apply separation force to avoid crowding from other boids
  _ApplySeparation(local) {
    //If no nearby boids, return a zero vector
    if (local.length == 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    const forceVector = new THREE.Vector3(0, 0, 0);
    //iterate through all nearby boids
    for (let e of local) {
      //calculate distance and adjust for radius
      const distanceToEntity = Math.max(
          e.Position.distanceTo(this.Position) - 1.5 * (this.Radius + e.Radius),
          0.001);
          //find the direction from other boid
      const directionFromEntity = new THREE.Vector3().subVectors(
          this.Position, e.Position);
          //scale the force based on distance and boids radius
      const multiplier = (
          _BOID_FORCE_SEPARATION / distanceToEntity) * (this.Radius + e.Radius);
      directionFromEntity.normalize();
      //Apply the force to seperate from other boids
      forceVector.add(
          directionFromEntity.multiplyScalar(multiplier));
    }
    return forceVector;
  }

  //Apply alignment force to align with the direction of nearby boids
  _ApplyAlignment(local) {
    const forceVector = new THREE.Vector3(0, 0, 0);

    //sun the directions of all nearby boids
    for (let e of local) {
      const entityDirection = e.Direction;
      forceVector.add(entityDirection);
    }

    //noramlise the resulting direction and apply scaling force
    forceVector.normalize();
    forceVector.multiplyScalar(_BOID_FORCE_ALIGNMENT);

    return forceVector;
  }
//apply cohesion force to steer toward the average position of nearby boids
  _ApplyCohesion(local) {
    const forceVector = new THREE.Vector3(0, 0, 0);
//if no nearby boids, return a zero vector
    if (local.length == 0) {
      return forceVector;
    }
// calculate the average position of nearby boids
    const averagePosition = new THREE.Vector3(0, 0, 0);
    for (let e of local) {
      averagePosition.add(e.Position);
    }

    averagePosition.multiplyScalar(1.0 / local.length);
   //Find direction to the averageposition and apply scaling force
    const directionToAveragePosition = averagePosition.clone().sub(
        this.Position);
    directionToAveragePosition.normalize();
    directionToAveragePosition.multiplyScalar(_BOID_FORCE_COHESION);

    return directionToAveragePosition;
  }
//Apply seek force to move towards a target (destination)
  _ApplySeek(destination) {
    const distance = Math.max(0,((
      //calculate the distance to the target and scale it 
        this.Position.distanceTo(destination) - 50) / 250)) ** 2;
        //calculate direction toward the destination 
    const direction = destination.clone().sub(this.Position);
    direction.normalize();

    //apply force toward the destination based on distance
    const forceVector = direction.multiplyScalar(
        _BOID_FORCE_ORIGIN * distance);
    return forceVector;
  }}
 
//FishDemo class extends a base game class to manage the boid simulation 
class FishDemo extends game.Game {
  constructor() {
    super(); //call the parent constructor
  }

  //initialisation method to set up the scene and load the resources
  _OnInitialize() { 
    this._entities = [];

    //set background fog for the scene (creating underwater effect)
    this._graphics.Scene.fog = new THREE.FogExp2(new THREE.Color(0x4d7dbe), 0.00);
   
    //load background texture image
    this._LoadBackground();


 
    //Load fish GTFL model using Three.js loader
    loader.load('./resources/fish.glb', (gltf) => {
      if (gltf && gltf.scene) {
        console.log('GLTF model loaded');
       
        
        // Find fishes mesh and materials
        let fishMesh = null;
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            console.log('Found mesh:', child);  // Log found mesh
            fishMesh = child;
          }
        });
    
        // If a mesh and material are found, pass to _CreateBoid
        if (fishMesh && fishMesh.material) {
          const fishMaterial = fishMesh.material;
          console.log('Using material:', fishMaterial);
    
          //  Create boids using mesh and material from fish model
          this._CreateBoids(fishMesh.geometry, fishMaterial); 
        } else {
          console.error('No material found in the fish mesh.');
        }

        const boundaryMin = new THREE.Vector3(-200, 5, -200);
        const boundaryMax = new THREE.Vector3(200, 100, 200);
    
        // Set up animations if available
        this._setUpAnimations(gltf);
      } else {
        console.error('Failed to load the model!');
      }
    }, undefined, (error) => {
      console.error('Error loading GLTF model:', error);
    });
    
    //create entities like plane and grif
    this._CreateEntities();

      // Set up fixed camera (e.g., 50 units above the origin, facing down)
  this._graphics._camera.position.set(200, 0, 10); // Set camera position at a fixed height above the origin
  this._graphics._camera.lookAt(new THREE.Vector3(0, 100, 0)); // Look at the origin
  }

  //;pad background texture (underwater scene)
  _LoadBackground() {
    const loader = new THREE.TextureLoader();
    const texture = loader.load('./resources/underwater.jpg');
    this._graphics._scene.background = texture;
  }

  //create entities for simulation ( eg groud plane)
  _CreateEntities() {

    //create ground place with a specific material
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400, 32, 32),
        new THREE.MeshStandardMaterial({
            color: 0x837860, //set colour etc
            transparent: true,
            opacity: 0 ,
        }));
    plane.position.set(0, -5, 0); //postion plane
    plane.castShadow = false; // Disable shadow casting 
    plane.receiveShadow = true; // Enable shadow recieving 
    plane.rotation.x = -Math.PI / 2; //Rotate plane to lay flat
    this._graphics.Scene.add(plane); //Add plane to scene

    //Initisalise visibility grid to manage entity position in the scene
    this._visibilityGrid = new visibility.VisibilityGrid(
        [new THREE.Vector3(-500, 0, -500), new THREE.Vector3(500, 0, 500)],
        [100, 100]);

  }

  // create boids based on geometry and material 
  _CreateBoids(fishGeometry, fishMaterial) {
    const NUM_BOIDS = 350;
  
    //parameteres to control the boids behaviour
    let params = {
      geometry: fishGeometry,  // Use the loaded geometry here
      material: fishMaterial,  // Pass the loaded material here
      speedMin: 3.0,
      speedMax: 4.0,
      speed: _BOID_SPEED,
      maxSteeringForce: _BOID_FORCE_MAX,
      acceleration: _BOID_ACCELERATION,
      colour: 0x80FF80,  // Default color as fallback
    };
    console.log('Creating boids with geometry:', fishGeometry);
  
    // Create the boids by instantiating the boid class
    for (let i = 0; i < NUM_BOIDS; i++) {
      const e = new Boid(this, params); //create boid entity 
      this._entities.push(e); // add it to the entity list
    }
  }
  
    // Set up animations for the loaded GLTF model
    _setUpAnimations(gltf) {
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
      
        //play all Animations in the GTLF model
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
        this._mixer = mixer; //store the mixer for later use
      } else {
        console.log("No animations found in the GLTF model.");
      } // currently no animation but no error code
    }

    // Step function to update the simulation each frame
  _OnStep(timeInSeconds) {
    //Limit the time step to a maximum value for stability, preventing jumps in time
    timeInSeconds = Math.min(timeInSeconds, 1 / 10.0);

    if (this._entities.length == 0) { //if there are no entities in the scene skip further calculation 
      return;
    }


    //Camera that follows the lead entitys direction

    // //Clone positionb of the first entitiy (boid) as the "eye" position
    // const eye = this._entities[0].Position.clone();

    // // get the direction of the first boid and scale it to set camera distance 
    // const dir = this._entities[0].Direction.clone();
    // dir.multiplyScalar(5); // Move 5 units back in the direction of the boid
    //  eye.sub(dir); // Position camera 5 units behind the lead boid
    
    //  // create a matrix to control the look-at direction of the camera
    // const m = new THREE.Matrix4();
    //   m.lookAt(eye, this._entities[0].Position, new THREE.Vector3(0, 1, 0));
    
    //   //set up a quaternion to rotate the camera for better view orientation
    //  const q = new THREE.Quaternion();
    //  q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); //rotate 90 degrees
     
     //smoothly adjust camera postion and orientation to follow the boid
    //  const oldPosition = this._graphics._camera.position;
    //  this._graphics._camera.position.lerp(eye, 0.05); //interpolate camera position
    //  this._graphics._camera.quaternion.copy(this._entities[0]._group.quaternion);
    //  this._graphics._camera.quaternion.multiply(q);
     //Optionally, the quaternion rotation could be further adjusted:
     //this._graphics._camera.quaternion.multiply(q);

     //disable camera controls to lock the view to the boid-following camera
    //  this._controls.enabled = false;


     //update each boid in the scene by calling its step function 
     // which applies the boid behaviours based on current step time
 // Final part of _OnStep to update each boid and handle animations
for (let e of this._entities) {
  e.Step(timeInSeconds);
}

 

  }
}

//Main entry point for the application
function _Main() {
  //Create an instance of Fish DEmo, this set up simulation
  _APP = new FishDemo();
}
//start simulation by calling the main function 
_Main();
