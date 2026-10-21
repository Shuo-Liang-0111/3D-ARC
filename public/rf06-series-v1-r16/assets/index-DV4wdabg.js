const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./runtime-gwpXOGE2.js","./rf01-shared-scene-C3lr5Wfb.js","./level-DHYXF6h6.js","./movement-DSrPwqFO.js","./level-CeHmt2dK.js","./rf01-yard-layout--oMqPTjc.js","./GLTFLoader-DvcdiufE.js","./three.module-DNzvjUP_.js","./three.core-BTd_SIMt.js","./rf01-battery-Oo_l0pAY.js","./HDRLoader-LqYDhsw8.js","./preload-helper-CmsKOCeN.js","./RoundedBoxGeometry-CzFB5SB1.js","./DRACOLoader-CLehr4Me.js","./runtime-wmk_2az8.js","./runtime-DbD7sU1d.js","./runtime-0CZz0dMi.js","./furniture-controller-D4Z6Wlz9.js","./interaction-walk-CoRdkiCg.js","./runtime-NQGQw5Fz.js","./series-runtime-CT4-QVJ-.js","./runtime-B6Oh46PZ.js","./runtime-qHdNZKBw.js","./runtime-HjKcTaja.js","./series-runtime-Cnhyb0pD.js","./runtime-wjC7uUk3.js","./runtime-DNkSlyEk.js","./series-entry-CkTxDWlZ.js","./series-runtime-DYnvPyEX.js","./runtime-CD8fWO0m.js","./runtime-BWHgWr0O.js","./runtime-CNCKxL6R.js","./series-runtime-B3OtS4Si.js","./series-animation-CBzfVTP-.js","./runtime-D7o7hLxk.js","./runtime-BpfdtDs1.js","./mujoco-client-C0I1hlm8.js","./runtime-D-ct4Ycv.js","./series-runtime-CdWmgbt9.js","./runtime-D-eij74g.js","./runtime-B-4UistZ.js","./runtime-DfXMtv-m.js","./rapier-DWaP5K6J.js","./spark.module-K79ainTr.js","./Pass-B5zfS6WH.js","./runtime-Blu96LHe.js","./runtime-DzmyXS47.js","./runtime-Cg12z4t1.js","./runtime-CfjZmGju.js","./RoomEnvironment-DqSPQOD6.js","./runtime-BOWk63id.js","./runtime-DoStYZfl.js","./runtime-DAgzPQRC.js","./scene-CycqWIJ-.js","./runtime-XXOW8ZzE.js","./orange-scene-C77uIPqY.js","./shared-variant-scene-CrC8cG66.js","./runtime-DXz0_Aj7.js","./runtime-Btp0Ykmp.js","./runtime-BRDagC8Z.js","./runtime-BJY3B9_6.js","./interaction-animation-VuM4AYIO.js"])))=>i.map(i=>d[i]);
import{_ as b}from"./preload-helper-CmsKOCeN.js";import{W as Rr}from"./three.module-DNzvjUP_.js";import{A as Nr,a as zr,P as Ur,S as Z,U as ie,V as q,W as we,H as ye,N as le,C as Ir,b as F,M as St,D as ki,R as Mt,c as Vr,d as ft,Z as ht,e as Oi,f as Ri,g as Br,h as $e,i as Fr,j as jr,k as Wr,l as Et,m as Hr,n as Gr,o as kr,p as Xr,q as _r,L as qr,r as Kr,s as Yr,t as Xi,u as Zr,v as Qr,w as Jr,T as Ni,x as $r,y as eo,z as to,B as io,E as ro,F as oo,G as Pt,I as ve,Q as so}from"./three.core-BTd_SIMt.js";import{g as _i,l as ao,c as Ut,a as qi,b as no,s as lo,U as pt,u as co,d as uo,e as zi,f as Ui,h as di}from"./rf01-battery-Oo_l0pAY.js";import{P as Se,F as st}from"./Pass-B5zfS6WH.js";import{M as fo,a as ho,G as po,p as mo,b as go,s as vo}from"./mujoco-client-C0I1hlm8.js";import"./rf01-yard-layout--oMqPTjc.js";import"./GLTFLoader-DvcdiufE.js";import"./HDRLoader-LqYDhsw8.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const n of o.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function i(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(r){if(r.ep)return;r.ep=!0;const o=i(r);fetch(r.href,o)}})();const xo=Object.freeze({pickup:"/local-assets/cardinal/rf01/audio/rf01_battery_pickup.mp3",drop:"/local-assets/cardinal/rf01/audio/rf01_battery_drop.mp3",power:"/local-assets/cardinal/rf01/audio/rf01_power_module_insert_and_startup.mp3"}),Ki=Object.freeze({battery_collected:"pickup",battery_dropped:"drop",power_restored:"power"}),wo=Object.freeze({pickup:.9,drop:.9,power:1});function yo(t,e=Ki){return e[t]??null}function bo(t,e,i={}){const s=i.assets??xo,r=i.eventSounds??Ki,o=i.volume??wo,n=new Nr,l=new zr,c=new Map,d=new Map,u=new Set;t.add(n),Object.entries(s).forEach(([y,N])=>{d.set(y,new Promise(A=>{l.load(N,m=>{c.set(y,m),A(!0)},void 0,()=>A(!1))}))});function S(){return n.context.state==="suspended"?n.context.resume():Promise.resolve()}function E(y,N){const A=c.get(y);if(!A)return!1;const m=new Ur(n);m.setBuffer(A),m.setRefDistance(16),m.setMaxDistance(80),m.setRolloffFactor(.45),m.setVolume(o[y]??.9),m.position.set(N.x,N.y??.8,N.z);const U=m.onEnded.bind(m);return m.onEnded=()=>{U(),u.delete(m),e.remove(m),m.disconnect()},e.add(m),u.add(m),m.play(),!0}function R(y,N){const A=yo(y,r);return A?(S(),E(A,N)||d.get(A)?.then(m=>{m&&E(A,N)}),!0):!1}function V(){u.forEach(y=>{y.isPlaying&&y.stop()})}return{unlock:S,playEvent:R,stopAll:V}}const De={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class So extends Se{constructor(e,i="tDiffuse"){super(),this.textureID=i,this.uniforms=null,this.material=null,e instanceof Z?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=ie.clone(e.uniforms),this.material=new Z({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new st(this.material)}render(e,i,s){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=s.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Ii extends Se{constructor(e,i){super(),this.scene=e,this.camera=i,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,i,s){const r=e.getContext(),o=e.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0);let n,l;this.inverse?(n=0,l=1):(n=1,l=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),o.buffers.stencil.setFunc(r.ALWAYS,n,4294967295),o.buffers.stencil.setClear(l),o.buffers.stencil.setLocked(!0),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.color.setMask(!0),o.buffers.depth.setMask(!0),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(r.EQUAL,1,4294967295),o.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),o.buffers.stencil.setLocked(!0)}}class To extends Se{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Ao{constructor(e,i){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),i===void 0){const s=e.getSize(new q);this._width=s.width,this._height=s.height,i=new we(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ye}),i.texture.name="EffectComposer.rt1"}else this._width=i.width,this._height=i.height;this.renderTarget1=i,this.renderTarget2=i.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new So(De),this.copyPass.material.blending=le,this.clock=new Ir}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,i){this.passes.splice(i,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const i=this.passes.indexOf(e);i!==-1&&this.passes.splice(i,1)}isLastEnabledPass(e){for(let i=e+1;i<this.passes.length;i++)if(this.passes[i].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const i=this.renderer.getRenderTarget();let s=!1;for(let r=0,o=this.passes.length;r<o;r++){const n=this.passes[r];if(n.enabled!==!1){if(n.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),n.render(this.renderer,this.writeBuffer,this.readBuffer,e,s),n.needsSwap){if(s){const l=this.renderer.getContext(),c=this.renderer.state.buffers.stencil;c.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),c.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}Ii!==void 0&&(n instanceof Ii?s=!0:n instanceof To&&(s=!1))}}this.renderer.setRenderTarget(i)}reset(e){if(e===void 0){const i=this.renderer.getSize(new q);this._pixelRatio=this.renderer.getPixelRatio(),this._width=i.width,this._height=i.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,i){this._width=e,this._height=i;const s=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(s,r),this.renderTarget2.setSize(s,r);for(let o=0;o<this.passes.length;o++)this.passes[o].setSize(s,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}const mt={defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new q},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new St},cameraProjectionMatrixInverse:{value:new St},cameraWorldMatrix:{value:new St},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new F(-1,-1,-1)},sceneBoxMax:{value:new F(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);
			if (depth >= 1.0) {
				discard;
				return;
			}
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},gt={defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},oi={uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function Mo(t=5){const e=Math.floor(t)%2===0?Math.floor(t)+1:Math.floor(t),i=Eo(e),s=i.length,r=new Uint8Array(s*4);for(let n=0;n<s;++n){const l=i[n],c=2*Math.PI*l/s,d=new F(Math.cos(c),Math.sin(c),0).normalize();r[n*4]=(d.x*.5+.5)*255,r[n*4+1]=(d.y*.5+.5)*255,r[n*4+2]=127,r[n*4+3]=255}const o=new ki(r,e,e);return o.wrapS=Mt,o.wrapT=Mt,o.needsUpdate=!0,o}function Eo(t){const e=Math.floor(t)%2===0?Math.floor(t)+1:Math.floor(t),i=e*e,s=Array(i).fill(0);let r=Math.floor(e/2),o=e-1;for(let n=1;n<=i;){if(r===-1&&o===e?(o=e-2,r=0):(o===e&&(o=0),r<0&&(r=e-1)),s[r*e+o]!==0){o-=2,r++;continue}else s[r*e+o]=n++;o++,r--}return s}const vt={defines:{SAMPLES:16,SAMPLE_VECTORS:Yi(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new q},cameraProjectionMatrixInverse:{value:new St},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function Yi(t,e,i){const s=Po(t,e,i);let r="vec3[SAMPLES](";for(let o=0;o<t;o++){const n=s[o];r+=`vec3(${n.x}, ${n.y}, ${n.z})${o<t-1?",":")"}`}return r}function Po(t,e,i){const s=[];for(let r=0;r<t;r++){const o=2*Math.PI*e*r/t,n=Math.pow(r/(t-1),i);s.push(new F(Math.cos(o),Math.sin(o),n))}return s}class Do{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let i=0;i<256;i++)this.p[i]=Math.floor(e.random()*256);this.perm=[];for(let i=0;i<512;i++)this.perm[i]=this.p[i&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,i){let s,r,o;const n=.5*(Math.sqrt(3)-1),l=(e+i)*n,c=Math.floor(e+l),d=Math.floor(i+l),u=(3-Math.sqrt(3))/6,S=(c+d)*u,E=c-S,R=d-S,V=e-E,y=i-R;let N,A;V>y?(N=1,A=0):(N=0,A=1);const m=V-N+u,U=y-A+u,D=V-1+2*u,W=y-1+2*u,p=c&255,C=d&255,H=this.perm[p+this.perm[C]]%12,f=this.perm[p+N+this.perm[C+A]]%12,v=this.perm[p+1+this.perm[C+1]]%12;let P=.5-V*V-y*y;P<0?s=0:(P*=P,s=P*P*this._dot(this.grad3[H],V,y));let L=.5-m*m-U*U;L<0?r=0:(L*=L,r=L*L*this._dot(this.grad3[f],m,U));let j=.5-D*D-W*W;return j<0?o=0:(j*=j,o=j*j*this._dot(this.grad3[v],D,W)),70*(s+r+o)}noise3d(e,i,s){let r,o,n,l;const d=(e+i+s)*.3333333333333333,u=Math.floor(e+d),S=Math.floor(i+d),E=Math.floor(s+d),R=1/6,V=(u+S+E)*R,y=u-V,N=S-V,A=E-V,m=e-y,U=i-N,D=s-A;let W,p,C,H,f,v;m>=U?U>=D?(W=1,p=0,C=0,H=1,f=1,v=0):m>=D?(W=1,p=0,C=0,H=1,f=0,v=1):(W=0,p=0,C=1,H=1,f=0,v=1):U<D?(W=0,p=0,C=1,H=0,f=1,v=1):m<D?(W=0,p=1,C=0,H=0,f=1,v=1):(W=0,p=1,C=0,H=1,f=1,v=0);const P=m-W+R,L=U-p+R,j=D-C+R,B=m-H+2*R,Be=U-f+2*R,Fe=D-v+2*R,je=m-1+3*R,We=U-1+3*R,_=D-1+3*R,Te=u&255,Ae=S&255,Me=E&255,lt=this.perm[Te+this.perm[Ae+this.perm[Me]]]%12,ct=this.perm[Te+W+this.perm[Ae+p+this.perm[Me+C]]]%12,dt=this.perm[Te+H+this.perm[Ae+f+this.perm[Me+v]]]%12,ut=this.perm[Te+1+this.perm[Ae+1+this.perm[Me+1]]]%12;let fe=.6-m*m-U*U-D*D;fe<0?r=0:(fe*=fe,r=fe*fe*this._dot3(this.grad3[lt],m,U,D));let he=.6-P*P-L*L-j*j;he<0?o=0:(he*=he,o=he*he*this._dot3(this.grad3[ct],P,L,j));let pe=.6-B*B-Be*Be-Fe*Fe;pe<0?n=0:(pe*=pe,n=pe*pe*this._dot3(this.grad3[dt],B,Be,Fe));let me=.6-je*je-We*We-_*_;return me<0?l=0:(me*=me,l=me*me*this._dot3(this.grad3[ut],je,We,_)),32*(r+o+n+l)}noise4d(e,i,s,r){const o=this.grad4,n=this.simplex,l=this.perm,c=(Math.sqrt(5)-1)/4,d=(5-Math.sqrt(5))/20;let u,S,E,R,V;const y=(e+i+s+r)*c,N=Math.floor(e+y),A=Math.floor(i+y),m=Math.floor(s+y),U=Math.floor(r+y),D=(N+A+m+U)*d,W=N-D,p=A-D,C=m-D,H=U-D,f=e-W,v=i-p,P=s-C,L=r-H,j=f>v?32:0,B=f>P?16:0,Be=v>P?8:0,Fe=f>L?4:0,je=v>L?2:0,We=P>L?1:0,_=j+B+Be+Fe+je+We,Te=n[_][0]>=3?1:0,Ae=n[_][1]>=3?1:0,Me=n[_][2]>=3?1:0,lt=n[_][3]>=3?1:0,ct=n[_][0]>=2?1:0,dt=n[_][1]>=2?1:0,ut=n[_][2]>=2?1:0,fe=n[_][3]>=2?1:0,he=n[_][0]>=1?1:0,pe=n[_][1]>=1?1:0,me=n[_][2]>=1?1:0,Li=n[_][3]>=1?1:0,Ht=f-Te+d,Gt=v-Ae+d,kt=P-Me+d,Xt=L-lt+d,_t=f-ct+2*d,qt=v-dt+2*d,Kt=P-ut+2*d,Yt=L-fe+2*d,Zt=f-he+3*d,Qt=v-pe+3*d,Jt=P-me+3*d,$t=L-Li+3*d,ei=f-1+4*d,ti=v-1+4*d,ii=P-1+4*d,ri=L-1+4*d,He=N&255,Ge=A&255,ke=m&255,Xe=U&255,Pr=l[He+l[Ge+l[ke+l[Xe]]]]%32,Dr=l[He+Te+l[Ge+Ae+l[ke+Me+l[Xe+lt]]]]%32,Cr=l[He+ct+l[Ge+dt+l[ke+ut+l[Xe+fe]]]]%32,Lr=l[He+he+l[Ge+pe+l[ke+me+l[Xe+Li]]]]%32,Or=l[He+1+l[Ge+1+l[ke+1+l[Xe+1]]]]%32;let _e=.6-f*f-v*v-P*P-L*L;_e<0?u=0:(_e*=_e,u=_e*_e*this._dot4(o[Pr],f,v,P,L));let qe=.6-Ht*Ht-Gt*Gt-kt*kt-Xt*Xt;qe<0?S=0:(qe*=qe,S=qe*qe*this._dot4(o[Dr],Ht,Gt,kt,Xt));let Ke=.6-_t*_t-qt*qt-Kt*Kt-Yt*Yt;Ke<0?E=0:(Ke*=Ke,E=Ke*Ke*this._dot4(o[Cr],_t,qt,Kt,Yt));let Ye=.6-Zt*Zt-Qt*Qt-Jt*Jt-$t*$t;Ye<0?R=0:(Ye*=Ye,R=Ye*Ye*this._dot4(o[Lr],Zt,Qt,Jt,$t));let Ze=.6-ei*ei-ti*ti-ii*ii-ri*ri;return Ze<0?V=0:(Ze*=Ze,V=Ze*Ze*this._dot4(o[Or],ei,ti,ii,ri)),27*(u+S+E+R+V)}_dot(e,i,s){return e[0]*i+e[1]*s}_dot3(e,i,s,r){return e[0]*i+e[1]*s+e[2]*r}_dot4(e,i,s,r,o){return e[0]*i+e[1]*s+e[2]*r+e[3]*o}}class re extends Se{constructor(e,i,s=512,r=512,o,n,l){super(),this.width=s,this.height=r,this.clear=!0,this.camera=i,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=Mo(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new we(this.width,this.height,{type:ye}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new Z({defines:Object.assign({},mt.defines),uniforms:ie.clone(mt.uniforms),vertexShader:mt.vertexShader,fragmentShader:mt.fragmentShader,blending:le,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new Vr,this.normalMaterial.blending=le,this.pdMaterial=new Z({defines:Object.assign({},vt.defines),uniforms:ie.clone(vt.uniforms),vertexShader:vt.vertexShader,fragmentShader:vt.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new Z({defines:Object.assign({},gt.defines),uniforms:ie.clone(gt.uniforms),vertexShader:gt.vertexShader,fragmentShader:gt.fragmentShader,blending:le}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new Z({uniforms:ie.clone(De.uniforms),vertexShader:De.vertexShader,fragmentShader:De.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:Ri,blendDst:ht,blendEquation:ft,blendSrcAlpha:Oi,blendDstAlpha:ht,blendEquationAlpha:ft}),this.blendMaterial=new Z({uniforms:ie.clone(oi.uniforms),vertexShader:oi.vertexShader,fragmentShader:oi.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:Br,blendSrc:Ri,blendDst:ht,blendEquation:ft,blendSrcAlpha:Oi,blendDstAlpha:ht,blendEquationAlpha:ft}),this._fsQuad=new st(null),this._originalClearColor=new $e,this.setGBuffer(o?o.depthTexture:void 0,o?o.normalTexture:void 0),n!==void 0&&this.updateGtaoMaterial(n),l!==void 0&&this.updatePdMaterial(l)}setSize(e,i){this.width=e,this.height=i,this.gtaoRenderTarget.setSize(e,i),this.normalRenderTarget.setSize(e,i),this.pdRenderTarget.setSize(e,i),this.gtaoMaterial.uniforms.resolution.value.set(e,i),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,i),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,i){e!==void 0?(this.depthTexture=e,this.normalTexture=i,this._renderGBuffer=!1):(this.depthTexture=new Fr,this.depthTexture.format=jr,this.depthTexture.type=Wr,this.normalRenderTarget=new we(this.width,this.height,{minFilter:Et,magFilter:Et,type:ye,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);const s=this.normalTexture?1:0,r=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=s,this.gtaoMaterial.defines.DEPTH_SWIZZLING=r,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=s,this.pdMaterial.defines.DEPTH_SWIZZLING=r,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&(e.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=e.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let i=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,i=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,i=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,i=!0),i&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Yi(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,i,s){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case re.OUTPUT.Off:break;case re.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=s.texture,this.copyMaterial.blending=le,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case re.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=le,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case re.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=le,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case re.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:i);break;case re.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=le,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i);break;case re.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=s.texture,this.copyMaterial.blending=le,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:i),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:i);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(e,i,s,r,o){e.getClearColor(this._originalClearColor);const n=e.getClearAlpha(),l=e.autoClear;e.setRenderTarget(s),e.autoClear=!1,r!=null&&(e.setClearColor(r),e.setClearAlpha(o||0),e.clear()),this._fsQuad.material=i,this._fsQuad.render(e),e.autoClear=l,e.setClearColor(this._originalClearColor),e.setClearAlpha(n)}_renderOverride(e,i,s,r,o){e.getClearColor(this._originalClearColor);const n=e.getClearAlpha(),l=e.autoClear;e.setRenderTarget(s),e.autoClear=!1,r=i.clearColor||r,o=i.clearAlpha||o,r!=null&&(e.setClearColor(r),e.setClearAlpha(o||0),e.clear()),this.scene.overrideMaterial=i,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=l,e.setClearColor(this._originalClearColor),e.setClearAlpha(n)}_overrideVisibility(){const e=this.scene,i=this._visibilityCache;e.traverse(function(s){(s.isPoints||s.isLine||s.isLine2)&&s.visible&&(s.visible=!1,i.push(s))})}_restoreVisibility(){const e=this._visibilityCache;for(let i=0;i<e.length;i++)e[i].visible=!0;e.length=0}_generateNoise(e=64){const i=new Do,s=e*e*4,r=new Uint8Array(s);for(let n=0;n<e;n++)for(let l=0;l<e;l++){const c=n,d=l;r[(n*e+l)*4]=(i.noise(c,d)*.5+.5)*255,r[(n*e+l)*4+1]=(i.noise(c+e,d)*.5+.5)*255,r[(n*e+l)*4+2]=(i.noise(c,d+e)*.5+.5)*255,r[(n*e+l)*4+3]=(i.noise(c+e,d+e)*.5+.5)*255}const o=new ki(r,e,e,Hr,Gr);return o.wrapS=Mt,o.wrapT=Mt,o.needsUpdate=!0,o}}re.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};const xt={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class Co extends Se{constructor(){super(),this.uniforms=ie.clone(xt.uniforms),this.material=new kr({name:xt.name,uniforms:this.uniforms,vertexShader:xt.vertexShader,fragmentShader:xt.fragmentShader}),this._fsQuad=new st(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,i,s){this.uniforms.tDiffuse.value=s.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Xr.getTransfer(this._outputColorSpace)===_r&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===qr?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Kr?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Yr?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Xi?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Zr?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Qr?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Jr&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Lo extends Se{constructor(e,i,s=null,r=null,o=null){super(),this.scene=e,this.camera=i,this.overrideMaterial=s,this.clearColor=r,this.clearAlpha=o,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new $e}render(e,i,s){const r=e.autoClear;e.autoClear=!1;let o,n;this.overrideMaterial!==null&&(n=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(o=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:s),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(o),this.overrideMaterial!==null&&(this.scene.overrideMaterial=n),e.autoClear=r}}const wt={defines:{SMAA_THRESHOLD:"0.1"},uniforms:{tDiffuse:{value:null},resolution:{value:new q(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		void SMAAEdgeDetectionVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAAEdgeDetectionVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {
			vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );

			// Calculate color deltas:
			vec4 delta;
			vec3 C = texture2D( colorTex, texcoord ).rgb;

			vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;
			vec3 t = abs( C - Cleft );
			delta.x = max( max( t.r, t.g ), t.b );

			vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;
			t = abs( C - Ctop );
			delta.y = max( max( t.r, t.g ), t.b );

			// We do the usual threshold:
			vec2 edges = step( threshold, delta.xy );

			// Then discard if there is no edge:
			if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )
				discard;

			// Calculate right and bottom deltas:
			vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;
			t = abs( C - Cright );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;
			t = abs( C - Cbottom );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the maximum delta in the direct neighborhood:
			float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );

			// Calculate left-left and top-top deltas:
			vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;
			t = abs( C - Cleftleft );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;
			t = abs( C - Ctoptop );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the final maximum delta:
			maxDelta = max( max( maxDelta, delta.z ), delta.w );

			// Local contrast adaptation in action:
			edges.xy *= step( 0.5 * maxDelta, delta.xy );

			return vec4( edges, 0.0, 0.0 );
		}

		void main() {

			gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );

		}`},yt={defines:{SMAA_MAX_SEARCH_STEPS:"8",SMAA_AREATEX_MAX_DISTANCE:"16",SMAA_AREATEX_PIXEL_SIZE:"( 1.0 / vec2( 160.0, 560.0 ) )",SMAA_AREATEX_SUBTEX_SIZE:"( 1.0 / 7.0 )"},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new q(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];
		varying vec2 vPixcoord;

		void SMAABlendingWeightCalculationVS( vec2 texcoord ) {
			vPixcoord = texcoord / resolution;

			// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 ); // WebGL port note: Changed sign in Y and W components
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 ); // WebGL port note: Changed sign in Y and W components

			// And these for the searches, they indicate the ends of the loops:
			vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );

		}

		void main() {

			vUv = uv;

			SMAABlendingWeightCalculationVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )

		uniform sampler2D tDiffuse;
		uniform sampler2D tArea;
		uniform sampler2D tSearch;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[3];
		varying vec2 vPixcoord;

		#if __VERSION__ == 100
		vec2 round( vec2 x ) {
			return sign( x ) * floor( abs( x ) + 0.5 );
		}
		#endif

		float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {
			// Not required if searchTex accesses are set to point:
			// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
			// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
			//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
			e.r = bias + e.r * scale;
			return 255.0 * texture2D( searchTex, e, 0.0 ).r;
		}

		float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			/**
				* @PSEUDO_GATHER4
				* This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
				* sample between edge, thus fetching four edges in a row.
				* Sampling with different offsets in each direction allows to disambiguate
				* which edges are active from the four fetched ones.
				*/
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			// We correct the previous (-0.25, -0.125) offset we applied:
			texcoord.x += 0.25 * resolution.x;

			// The searches are bias by 1, so adjust the coords accordingly:
			texcoord.x += resolution.x;

			// Disambiguate the length added by the last step:
			texcoord.x += 2.0 * resolution.x; // Undo last step
			texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);

			return texcoord.x;
		}

		float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			texcoord.x -= 0.25 * resolution.x;
			texcoord.x -= resolution.x;
			texcoord.x -= 2.0 * resolution.x;
			texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );

			return texcoord.x;
		}

		float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y -= 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y; // WebGL port note: Changed sign
			texcoord.y -= 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y += 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y; // WebGL port note: Changed sign
			texcoord.y += 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {
			// Rounding prevents precision errors of bilinear filtering:
			vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;

			// We do a scale and bias for mapping to texel space:
			texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );

			// Move to proper place, according to the subpixel offset:
			texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

			return texture2D( areaTex, texcoord, 0.0 ).rg;
		}

		vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {
			vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );

			vec2 e = texture2D( edgesTex, texcoord ).rg;

			if ( e.g > 0.0 ) { // Edge at north
				vec2 d;

				// Find the distance to the left:
				vec2 coords;
				coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );
				coords.y = offset[ 1 ].y; // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
				d.x = coords.x;

				// Now fetch the left crossing edges, two at a time using bilinear
				// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
				// discern what value each edge has:
				float e1 = texture2D( edgesTex, coords, 0.0 ).r;

				// Find the distance to the right:
				coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );
				d.y = coords.x;

				// We want the distances to be in pixel units (doing this here allow to
				// better interleave arithmetic and memory accesses):
				d = d / resolution.x - pixcoord.x;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the right crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;

				// Ok, we know how this pattern looks like, now it is time for getting
				// the actual area:
				weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );
			}

			if ( e.r > 0.0 ) { // Edge at west
				vec2 d;

				// Find the distance to the top:
				vec2 coords;

				coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );
				coords.x = offset[ 0 ].x; // offset[1].x = texcoord.x - 0.25 * resolution.x;
				d.x = coords.y;

				// Fetch the top crossing edges:
				float e1 = texture2D( edgesTex, coords, 0.0 ).g;

				// Find the distance to the bottom:
				coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );
				d.y = coords.y;

				// We want the distances to be in pixel units:
				d = d / resolution.y - pixcoord.y;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the bottom crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;

				// Get the area for this direction:
				weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );
			}

			return weights;
		}

		void main() {

			gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );

		}`},si={uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new q(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		void SMAANeighborhoodBlendingVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAANeighborhoodBlendingVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform sampler2D tColor;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {
			// Fetch the blending weights for current pixel:
			vec4 a;
			a.xz = texture2D( blendTex, texcoord ).xz;
			a.y = texture2D( blendTex, offset[ 1 ].zw ).g;
			a.w = texture2D( blendTex, offset[ 1 ].xy ).a;

			// Is there any blending weight with a value greater than 0.0?
			if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {
				return texture2D( colorTex, texcoord, 0.0 );
			} else {
				// Up to 4 lines can be crossing a pixel (one through each edge). We
				// favor blending by choosing the line with the maximum weight for each
				// direction:
				vec2 offset;
				offset.x = a.a > a.b ? a.a : -a.b; // left vs. right
				offset.y = a.g > a.r ? -a.g : a.r; // top vs. bottom // WebGL port note: Changed signs

				// Then we go in the direction that has the maximum weight:
				if ( abs( offset.x ) > abs( offset.y )) { // horizontal vs. vertical
					offset.y = 0.0;
				} else {
					offset.x = 0.0;
				}

				// Fetch the opposite color and lerp by hand:
				vec4 C = texture2D( colorTex, texcoord, 0.0 );
				texcoord += sign( offset ) * resolution;
				vec4 Cop = texture2D( colorTex, texcoord, 0.0 );
				float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );

				// WebGL port note: Added gamma correction
				C.xyz = pow(C.xyz, vec3(2.2));
				Cop.xyz = pow(Cop.xyz, vec3(2.2));
				vec4 mixed = mix(C, Cop, s);
				mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));

				return mixed;
			}
		}

		void main() {

			gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );

		}`};class Oo extends Se{constructor(){super(),this._edgesRT=new we(1,1,{depthBuffer:!1,type:ye}),this._edgesRT.texture.name="SMAAPass.edges",this._weightsRT=new we(1,1,{depthBuffer:!1,type:ye}),this._weightsRT.texture.name="SMAAPass.weights";const e=this,i=new Image;i.src=this._getAreaTexture(),i.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new Ni,this._areaTexture.name="SMAAPass.area",this._areaTexture.image=i,this._areaTexture.minFilter=$r,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;const s=new Image;s.src=this._getSearchTexture(),s.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new Ni,this._searchTexture.name="SMAAPass.search",this._searchTexture.image=s,this._searchTexture.magFilter=Et,this._searchTexture.minFilter=Et,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=ie.clone(wt.uniforms),this._materialEdges=new Z({defines:Object.assign({},wt.defines),uniforms:this._uniformsEdges,vertexShader:wt.vertexShader,fragmentShader:wt.fragmentShader}),this._uniformsWeights=ie.clone(yt.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new Z({defines:Object.assign({},yt.defines),uniforms:this._uniformsWeights,vertexShader:yt.vertexShader,fragmentShader:yt.fragmentShader}),this._uniformsBlend=ie.clone(si.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new Z({uniforms:this._uniformsBlend,vertexShader:si.vertexShader,fragmentShader:si.fragmentShader}),this._fsQuad=new st(null)}render(e,i,s){this._uniformsEdges.tDiffuse.value=s.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear&&e.clear(),this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear&&e.clear(),this._fsQuad.render(e),this._uniformsBlend.tColor.value=s.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this.clear&&e.clear(),this._fsQuad.render(e))}setSize(e,i){this._edgesRT.setSize(e,i),this._weightsRT.setSize(e,i),this._materialEdges.uniforms.resolution.value.set(1/e,1/i),this._materialWeights.uniforms.resolution.value.set(1/e,1/i),this._materialBlend.uniforms.resolution.value.set(1/e,1/i)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return"data:image/png;base64,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"}_getSearchTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII="}}const Ro={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new $e(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Ve extends Se{constructor(e,i=1,s,r){super(),this.strength=i,this.radius=s,this.threshold=r,this.resolution=e!==void 0?new q(e.x,e.y):new q(256,256),this.clearColor=new $e(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let o=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);this.renderTargetBright=new we(o,n,{type:ye}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){const S=new we(o,n,{type:ye});S.texture.name="UnrealBloomPass.h"+u,S.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(S);const E=new we(o,n,{type:ye});E.texture.name="UnrealBloomPass.v"+u,E.texture.generateMipmaps=!1,this.renderTargetsVertical.push(E),o=Math.round(o/2),n=Math.round(n/2)}const l=Ro;this.highPassUniforms=ie.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Z({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];const c=[3,5,7,9,11];o=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(c[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new q(1/o,1/n),o=Math.round(o/2),n=Math.round(n/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=i,this.compositeMaterial.uniforms.bloomRadius.value=.1;const d=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=d,this.bloomTintColors=[new F(1,1,1),new F(1,1,1),new F(1,1,1),new F(1,1,1),new F(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=ie.clone(De.uniforms),this.blendMaterial=new Z({uniforms:this.copyUniforms,vertexShader:De.vertexShader,fragmentShader:De.fragmentShader,blending:eo,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new $e,this._oldClearAlpha=1,this._basic=new to,this._fsQuad=new st(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,i){let s=Math.round(e/2),r=Math.round(i/2);this.renderTargetBright.setSize(s,r);for(let o=0;o<this.nMips;o++)this.renderTargetsHorizontal[o].setSize(s,r),this.renderTargetsVertical[o].setSize(s,r),this.separableBlurMaterials[o].uniforms.invSize.value=new q(1/s,1/r),s=Math.round(s/2),r=Math.round(r/2)}render(e,i,s,r,o){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const n=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),o&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=s.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=s.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let l=this.renderTargetBright;for(let c=0;c<this.nMips;c++)this._fsQuad.material=this.separableBlurMaterials[c],this.separableBlurMaterials[c].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[c].uniforms.direction.value=Ve.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[c]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[c].uniforms.colorTexture.value=this.renderTargetsHorizontal[c].texture,this.separableBlurMaterials[c].uniforms.direction.value=Ve.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[c]),e.clear(),this._fsQuad.render(e),l=this.renderTargetsVertical[c];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,o&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(s),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=n}_getSeparableBlurMaterial(e){const i=[];for(let s=0;s<e;s++)i.push(.39894*Math.exp(-.5*s*s/(e*e))/e);return new Z({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new q(.5,.5)},direction:{value:new q(.5,.5)},gaussianCoefficients:{value:i}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(e){return new Z({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}Ve.BlurDirectionX=new q(1,0);Ve.BlurDirectionY=new q(0,1);const Qe=Object.freeze({target:"desktop-1080p-30fps",effects:Object.freeze(["gtao","smaa","selective-threshold-bloom","aces"]),gtao:Object.freeze({radius:.34,distanceExponent:1.6,thickness:.85,distanceFallOff:1,scale:1,samples:16}),bloom:Object.freeze({strength:.16,radius:.22,threshold:1.2})});function No(t,e,i){const s=new Ao(t),r=new Lo(e,i),o=new re(e,i,window.innerWidth,window.innerHeight);o.output=re.OUTPUT.Default,o.blendIntensity=.82,o.updateGtaoMaterial(Qe.gtao),o.updatePdMaterial({lumaPhi:8,depthPhi:2,normalPhi:3,radius:6,radiusExponent:2,rings:2,samples:16}),o.setSceneClipBox(new io(new F(-24,-1,-24),new F(24,9,22)));const n=new Ve(new q(window.innerWidth,window.innerHeight),Qe.bloom.strength,Qe.bloom.radius,Qe.bloom.threshold),l=new Oo,c=new Co;return s.addPass(r),s.addPass(o),s.addPass(n),s.addPass(l),s.addPass(c),{profile:Qe,render(d=i){r.camera=d,o.camera=d,o.gtaoMaterial.defines.PERSPECTIVE_CAMERA=d.isPerspectiveCamera?1:0,s.render()},setSize(d,u){s.setSize(d,u)}}}const Zi=.8,Si=.5,zo=Object.freeze({office_bin_picked_up:"pickup",office_bin_placed:"place",battery_collected:"pickup",battery_dropped:"place",power_restored:"place",crate_collected:"pickup",crate_dropped:"place",crate_delivered:"place",shutter_opening:"operate",workshop_lit:"operate",workshop_dark:"operate",dynamic_stop_requested:"operate",dynamic_interlock_locked:"operate",door_opened:"operate",door_closed:"operate",terminal_opened:"operate",dispatch_confirmed:"operate",item_collected_adapter:"pickup",item_collected_clicker:"pickup",item_recollected_adapter:"pickup",item_recollected_clicker:"pickup",item_dropped_adapter:"place",item_dropped_clicker:"place",device_installed_adapter:"place",device_installed_clicker:"place"}),Uo=Object.freeze({battery_collected:Object.freeze({duration:1.35,contactProgress:.52,gesture:"two-hand-lift"}),battery_dropped:Object.freeze({duration:1.25,contactProgress:.58,gesture:"two-hand-place"}),power_restored:Object.freeze({duration:1.45,contactProgress:.6,gesture:"two-hand-install"}),crate_collected:Object.freeze({duration:1.55,contactProgress:.54,gesture:"two-hand-lift"}),crate_dropped:Object.freeze({duration:1.45,contactProgress:.6,gesture:"two-hand-place"}),crate_delivered:Object.freeze({duration:1.55,contactProgress:.62,gesture:"two-hand-place"}),shutter_opening:Object.freeze({duration:1.05,contactProgress:.55,gesture:"right-hand-press"}),workshop_lit:Object.freeze({duration:.95,contactProgress:.52,gesture:"right-hand-press"}),workshop_dark:Object.freeze({duration:.95,contactProgress:.52,gesture:"right-hand-press"}),dynamic_stop_requested:Object.freeze({duration:1.05,contactProgress:.55,gesture:"right-hand-press"}),dynamic_interlock_locked:Object.freeze({duration:1.2,contactProgress:.6,gesture:"right-hand-confirm"}),door_opened:Object.freeze({duration:1.05,contactProgress:.55,gesture:"right-hand-press"}),door_closed:Object.freeze({duration:1.05,contactProgress:.55,gesture:"right-hand-press"}),terminal_opened:Object.freeze({duration:1.05,contactProgress:.55,gesture:"right-hand-press"}),dispatch_confirmed:Object.freeze({duration:1.15,contactProgress:.58,gesture:"right-hand-confirm"})});function Ti(){return{kind:"idle",active:!1,elapsed:0,duration:Zi,contactProgress:Si,gesture:"idle",event:null,beforeCarrying:!1,afterCarrying:!1,beforeVisualState:null}}function Io(t){return structuredClone(t)}function ui(t){return t.battery?.location==="carried"||!!t.carriedItem}function Vi(t){const e=Math.max(0,Math.min(1,t));return e*e*(3-2*e)}function Vo(){return Ti()}function Bo(t){return zo[t]??null}function ae(t){return!!t?.active}function Fo(t,e,i,s){const r=Bo(e);if(!r||ae(t))return t;const o=Uo[e]??{};return{kind:r,active:!0,elapsed:0,duration:o.duration??Zi,contactProgress:o.contactProgress??Si,gesture:o.gesture??(r==="pickup"?"two-hand-lift":"two-hand-place"),event:e,beforeCarrying:ui(i),afterCarrying:ui(s),beforeVisualState:Io(i)}}function jo(t,e){if(!ae(t))return t;const i=Math.min(t.duration,t.elapsed+Math.max(0,e));return i>=t.duration?Ti():{...t,elapsed:i}}function at(){return Ti()}function Dt(t,e=!1){if(!ae(t))return{kind:"idle",gesture:"idle",progress:1,contactReached:!0,visualCarrying:e,reach:0,operationBlend:0,crouch:0,carryBlend:e?1:0,grip:e?.82:.16};const i=Math.max(0,Math.min(1,t.elapsed/t.duration)),s=t.contactProgress??Si,r=i>=s,o=Vi(i/s),n=Vi((i-s)/(1-s)),l=r?1-n:o,c=t.kind==="pickup",d=t.kind==="operate";return{kind:t.kind,gesture:t.gesture,progress:i,contactReached:r,visualCarrying:r?t.afterCarrying:t.beforeCarrying,reach:l,operationBlend:d?l:0,crouch:d?0:Math.sin(i*Math.PI)*.28,carryBlend:d?e?1:0:c?r?n:0:r?0:1-o*.42,grip:d?e?.82:.16:c?r?.82:.16+o*.66:r?.16:.82-o*.66}}function Wo(t,e){return!ae(t)||Dt(t,ui(e)).contactReached?e:structuredClone(t.beforeVisualState)}const Bi=new Set(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE","ArrowUp","ArrowDown"]);function Re(t,e){t&&t.textContent!==e&&(t.textContent=e)}function Ho({root:t,pressControl:e,releaseControl:i,interact:s,reset:r,stop:o}){if(!t)return null;const n=t.querySelector("#operator-control-state"),l=t.querySelector("#operator-motion-state"),c=t.querySelector("#operator-input-state"),d=t.querySelector("#operator-stop"),u=document.querySelector("#operator-live-label"),S=document.querySelector("#operator-live-pip"),E=document.querySelector("#operator-feed-path"),R=document.querySelector("#operator-clock"),V=[...t.querySelectorAll("[data-control-code]")],y=[...t.querySelectorAll("[data-operator-action]")],N=new Map,A=new Set;let m=!1;V.forEach(f=>{const v=f.dataset.controlCode;if(!Bi.has(v))return;const P=N.get(v)??[];P.push(f),N.set(v,P);const L=B=>{m&&(B.preventDefault(),B.pointerId!==void 0&&f.setPointerCapture?.(B.pointerId),e(v))},j=B=>{B?.preventDefault(),i(v)};f.addEventListener("pointerdown",L),f.addEventListener("pointerup",j),f.addEventListener("pointercancel",j),f.addEventListener("lostpointercapture",j),f.addEventListener("contextmenu",B=>B.preventDefault()),f.addEventListener("keydown",B=>{(B.code==="Space"||B.code==="Enter")&&!B.repeat&&L(B)}),f.addEventListener("keyup",B=>{(B.code==="Space"||B.code==="Enter")&&j(B)}),f.addEventListener("blur",()=>i(v))}),y.forEach(f=>{f.addEventListener("click",()=>{if(!m)return;const v=f.dataset.operatorAction;f.classList.add("active"),window.setTimeout(()=>f.classList.remove("active"),180),v==="interact"?s():v==="reset"&&r()})}),d?.addEventListener("click",()=>{o(),D()});function U(f,v){Bi.has(f)&&(v?A.add(f):A.delete(f),(N.get(f)??[]).forEach(P=>{P.classList.toggle("active",v),P.setAttribute("aria-pressed",String(v))}))}function D(){[...A].forEach(f=>U(f,!1))}function W(f){m&&!f&&([...A].forEach(v=>i(v)),D()),m=f,t.dataset.controlEnabled=String(m),V.forEach(v=>{v.disabled=!m}),y.forEach(v=>{v.disabled=!m}),d&&(d.disabled=!m)}function p({controlEnabled:f,controlMode:v,motion:P,input:L,feed:j,level:B}){W(!!f),Re(n,v),n?.classList.toggle("online",v==="LOCAL"),n?.classList.toggle("agent",v==="AGENT"),Re(l,P),Re(c,L),c?.classList.toggle("ready",L==="READY"),c?.classList.toggle("agent",L==="AGENT"),Re(u,j),Re(E,`${B} → LOCAL SIM → G1`),S?.classList.toggle("streaming",j==="RUNNING"),S?.classList.toggle("agent",j==="AGENT")}function C(){Re(R,new Date().toLocaleTimeString("zh-CN",{hour12:!1}))}C();const H=window.setInterval(C,1e3);return t.dataset.controlEnabled="false",V.forEach(f=>{f.disabled=!0}),y.forEach(f=>{f.disabled=!0}),{clearPressed:D,setPressed:U,update:p,destroy(){window.clearInterval(H),D()}}}function Go(t,e,i){return t==="first"?null:t==="third"?{x:0,y:0,width:e,height:i}:t!=="dual"?null:e>=i?{x:e/2,y:0,width:e/2,height:i}:{x:0,y:i/2,width:e,height:i/2}}function ko(t,e,i,s,r){const o=Go(t,e,i);return o?s>=o.x&&s<=o.x+o.width&&r>=o.y&&r<=o.y+o.height:!1}function Xo(t,e,i=.35,s=2.6){const r=t*Math.exp(e*.0012);return Math.min(s,Math.max(i,r))}function _o({element:t,shell:e,getViewMode:i,onOrbit:s,onZoom:r}){if(!t||!e)return null;let o=!1,n=!1,l=!1,c=null,d=0,u=0;function S(p){const C=t.getBoundingClientRect(),H=p.clientX-C.left,f=p.clientY-C.top;return ko(i(),C.width,C.height,H,f)}function E(){e.dataset.thirdViewSelected=String(o),e.dataset.thirdViewHovered=String(n),e.dataset.thirdViewDragging=String(l)}function R(p){o=!!p,E()}function V(p){n=!!p,E()}function y(p){l&&(p?.pointerId!==void 0&&c!==null&&p.pointerId!==c||(l=!1,c=null,E()))}function N(p){const C=S(p);if(p.button===0){R(C);return}p.button!==1||!C||(p.preventDefault(),o=!0,n=!0,l=!0,c=p.pointerId,d=p.clientX,u=p.clientY,t.setPointerCapture?.(p.pointerId),E())}function A(p){if(!l){V(S(p));return}if(c!==null&&p.pointerId!==c)return;const C=p.clientX-d,H=p.clientY-u;d=p.clientX,u=p.clientY,s({yaw:-C*.005,pitch:-H*.004})}function m(p){S(p)&&(p.preventDefault(),V(!0),r(p.deltaY))}function U(p){p.button===1&&S(p)&&p.preventDefault()}function D(){l||V(!1)}function W(){i()==="first"&&(n=!1,l=!1,c=null),E()}return t.addEventListener("pointerdown",N),t.addEventListener("pointermove",A),t.addEventListener("pointerup",y),t.addEventListener("pointercancel",y),t.addEventListener("lostpointercapture",y),t.addEventListener("pointerleave",D),t.addEventListener("wheel",m,{passive:!1}),t.addEventListener("auxclick",U),window.addEventListener("blur",y),W(),{refresh:W,getState:()=>({selected:o,hovered:n,dragging:l}),destroy(){t.removeEventListener("pointerdown",N),t.removeEventListener("pointermove",A),t.removeEventListener("pointerup",y),t.removeEventListener("pointercancel",y),t.removeEventListener("lostpointercapture",y),t.removeEventListener("pointerleave",D),t.removeEventListener("wheel",m),t.removeEventListener("auxclick",U),window.removeEventListener("blur",y)}}}const qo=Object.freeze(["first","third","dual"]),Qi="third";function Fi(t,e){if(t.width/Math.max(1,t.height)>e){const r=t.height*e;return{...t,x:t.x+(t.width-r)/2,width:r}}const s=t.width/e;return{...t,y:t.y+(t.height-s)/2,height:s}}function fi(t){return qo.includes(t)?t:null}function Ji(t,e){return fi(t)??fi(e)??Qi}function $i(t,e,i){const s=fi(t)??Qi;if(s==="first")return[{view:"first",x:0,y:0,width:e,height:i}];if(s==="third")return[{view:"third",x:0,y:0,width:e,height:i}];if(e>=i){const o=e/2;return[{view:"first",x:0,y:0,width:o,height:i},{view:"third",x:o,y:0,width:o,height:i}]}const r=i/2;return[{view:"first",x:0,y:r,width:e,height:r},{view:"third",x:0,y:0,width:e,height:r}]}const Q=new URLSearchParams(window.location.search),hi=Q.get("level"),M=["rf01","rf01-2","rf01-3","rf02","rf02-2","rf02-3","rf03","rf04","rf04-2","rf04-3","rf05","rf05-2","rf05-3","rf06","rf06-2","rf06-3","rf07","rf07-2","rf07-3","rf08","rf09","rf10","rf11","rf12","rf13","rf14","rf15","rf15-1","rf15-2","rf15-3","test_zpf","test_zpf2"].includes(hi)?hi:"rf01",G=M==="rf11",J=_i(G?"g1":Q.get("robot")),$=J.id,Ko=Q.get("control"),k=$==="g1"&&!G&&Ko==="joint"?"joint":"velocity",Yo=fo[k],be=!!(Q.get("episode")&&Q.get("browser_token")),ce=Q.get("mode")||(be?"agent":hi?"play":"home"),Zo=ce==="home"&&!be,er="arc-view-mode";let tr=null;try{tr=window.localStorage.getItem(er)}catch{}let X=Ji(Q.get("view"),tr);const Qo={rf01:()=>b(()=>import("./runtime-gwpXOGE2.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13]),import.meta.url),"rf01-2":()=>b(()=>import("./runtime-wmk_2az8.js"),__vite__mapDeps([14,1,2,3,4,5,6,7,8,9,10,11,12,13]),import.meta.url),"rf01-3":()=>b(()=>import("./runtime-DbD7sU1d.js"),__vite__mapDeps([15,1,2,3,4,5,6,7,8,9,10,11,12,13]),import.meta.url),rf02:()=>b(()=>import("./runtime-0CZz0dMi.js"),__vite__mapDeps([16,17,6,7,8,13,18,3]),import.meta.url),"rf02-2":()=>b(()=>import("./runtime-NQGQw5Fz.js"),__vite__mapDeps([19,20,3,17,6,7,8,13,18]),import.meta.url),"rf02-3":()=>b(()=>import("./runtime-B6Oh46PZ.js"),__vite__mapDeps([21,20,3,17,6,7,8,13,18]),import.meta.url),rf03:()=>b(()=>import("./runtime-qHdNZKBw.js"),__vite__mapDeps([22,2,3,13,7,8,6]),import.meta.url),rf04:()=>b(()=>import("./runtime-HjKcTaja.js"),__vite__mapDeps([23,24,3,6,7,8,13,11,18]),import.meta.url),"rf04-2":()=>b(()=>import("./runtime-wjC7uUk3.js"),__vite__mapDeps([25,24,3,6,7,8,13,11,18]),import.meta.url),"rf04-3":()=>b(()=>import("./runtime-DNkSlyEk.js"),__vite__mapDeps([26,24,3,6,7,8,13,11,18]),import.meta.url),rf05:()=>b(()=>import("./series-entry-CkTxDWlZ.js"),__vite__mapDeps([27,28,3,8,13,7,6,11,18]),import.meta.url),"rf05-2":()=>b(()=>import("./runtime-CD8fWO0m.js"),__vite__mapDeps([29,28,3,8,13,7,6,11,18]),import.meta.url),"rf05-3":()=>b(()=>import("./runtime-BWHgWr0O.js"),__vite__mapDeps([30,28,3,8,13,7,6,11,18]),import.meta.url),rf06:()=>b(()=>import("./runtime-CNCKxL6R.js"),__vite__mapDeps([31,32,33,11,18,8,3,6,7,13]),import.meta.url),"rf06-2":()=>b(()=>import("./runtime-D7o7hLxk.js"),__vite__mapDeps([34,32,33,11,18,8,3,6,7,13]),import.meta.url),"rf06-3":()=>b(()=>import("./runtime-BpfdtDs1.js").then(t=>t.r),__vite__mapDeps([35,33,11,18,8,3,6,7,13,36]),import.meta.url),rf07:()=>b(()=>import("./runtime-D-ct4Ycv.js"),__vite__mapDeps([37,38,3,13,7,8,6,11,18]),import.meta.url),"rf07-2":()=>b(()=>import("./runtime-D-eij74g.js"),__vite__mapDeps([39,38,3,13,7,8,6,11,18]),import.meta.url),"rf07-3":()=>b(()=>import("./runtime-B-4UistZ.js"),__vite__mapDeps([40,38,3,13,7,8,6,11,18]),import.meta.url),rf08:()=>b(()=>import("./runtime-DfXMtv-m.js"),__vite__mapDeps([41,8,3,42,43,7,44,6]),import.meta.url),rf09:()=>b(()=>import("./runtime-Blu96LHe.js"),__vite__mapDeps([45,3,6,7,8]),import.meta.url),rf10:()=>b(()=>import("./runtime-DzmyXS47.js"),__vite__mapDeps([46,3,6,7,8,43,44]),import.meta.url),rf11:()=>b(()=>import("./runtime-Cg12z4t1.js"),__vite__mapDeps([47,13,7,8,6]),import.meta.url),rf12:()=>b(()=>import("./runtime-CfjZmGju.js"),__vite__mapDeps([48,3,7,8,13,6,49]),import.meta.url),rf13:()=>b(()=>import("./runtime-BOWk63id.js"),__vite__mapDeps([50,3,4,5,7,8,6,13,49]),import.meta.url),rf14:()=>b(()=>import("./runtime-DoStYZfl.js"),__vite__mapDeps([51,3,4,5,7,8,6,13,49,10]),import.meta.url),rf15:()=>b(()=>import("./runtime-DAgzPQRC.js"),__vite__mapDeps([52,53,11,7,8,6,13,49,3,4,5]),import.meta.url),"rf15-1":()=>b(()=>import("./runtime-XXOW8ZzE.js"),__vite__mapDeps([54,53,11,7,8,6,13,49,3,4,5,55,56]),import.meta.url),"rf15-2":()=>b(()=>import("./runtime-DXz0_Aj7.js"),__vite__mapDeps([57,53,11,7,8,6,13,49,3,4,5,55,56]),import.meta.url),"rf15-3":()=>b(()=>import("./runtime-Btp0Ykmp.js"),__vite__mapDeps([58,53,11,7,8,6,13,49,3,4,5,55,56]),import.meta.url),test_zpf:()=>b(()=>import("./runtime-BRDagC8Z.js"),__vite__mapDeps([59,3,8]),import.meta.url),test_zpf2:()=>b(()=>import("./runtime-BJY3B9_6.js"),__vite__mapDeps([60,3,7,8,49,12]),import.meta.url)},h=await Qo[M](),{LEVEL:ir}=h,Jo=Object.freeze({rf01:"恢复园区供电，打开园区大门并抵达出口","rf01-2":"进入厂房并开启照明","rf01-3":"完成三件快递的正确分拣",rf02:"完成馆藏归位","rf02-2":"将两把椅子推到桌边，还书车停入右侧墙边的黄色停车区","rf02-3":"椅子推到桌边，还书车停入右侧黄色停车区，并归还三本随机落书",rf03:"完成快递分拣",rf04:"完成衣物洗涤与晾晒","rf04-2":"洗净、晾干并分类收好三件衣物","rf04-3":"收好三件衣物，并将扫地机器人放回充电区",rf05:"将旧毛巾、水杯和垃圾分别回收，完成客房整理","rf05-2":"回收旧物，并为双床客房补齐两套干净毛巾和水杯","rf05-3":"完成客房回收补给、积水清理及家具归位，确认客房可交付",rf06:"关闭漏水阀门，接住残水、清理积水并归还工具。","rf06-2":"止住漏水，清除扩散的积水并归还工具。","rf06-3":"拿起杀虫剂，消灭住宅内的两只蟑螂。",rf07:"完成冷链转运","rf07-2":"启动全部三台冷藏柜","rf07-3":"完成冷链转运并处置泄漏报警",rf08:"自由探索实景办公室",rf09:"启动会议演示",rf10:"自由探索会议室重建场景",rf11:"完成双机器人协作搬运",rf12:"完成家庭厨房安全任务",rf13:"完成社区诊所开诊任务",rf14:"收集网球并全部归筐",rf15:"将两箱农产品装入冷藏车，并完成出库确认","rf15-1":"手推车归位","rf15-2":"田间收割入筐","rf15-3":"动态称重装车",test_zpf:"完成小办公室三点巡检",test_zpf2:"完成小办公室巡检"}),Tt=Jo[M],g=t=>document.querySelector(t),$o=g("#viewport"),x=g("#game-shell"),Ai=g("#home-overlay"),Mi=g("#start-overlay"),Ei=g("#terminal-overlay"),rr=g("#complete-overlay"),pi=g("#failure-overlay"),Ce=g("#start-button"),It=g("#return-to-levels"),es=Ce.innerHTML,ts=g("#restart-button"),is=g("#failure-restart-button"),rs=g("#terminal-close"),or=g("#objective-title"),mi=g("#power-label"),os=g("#system-light"),sr=g("#robot-state"),ar=g("#cargo-state"),nr=g("#gate-state"),ai=g("#toast"),ni=g("#progress-meter"),ss=g("#progress-fill"),lr=g("#progress-value"),cr=g("#terminal-title"),dr=g("#terminal-copy"),ur=[g("#terminal-label-1"),g("#terminal-label-2"),g("#terminal-label-3")],fr=[g("#terminal-battery"),g("#terminal-power"),g("#terminal-door")],hr=[...document.querySelectorAll("[data-view-option]")],pr=[...document.querySelectorAll("[data-level-option]")],mr=[...document.querySelectorAll("[data-robot-option]")],gr=[...document.querySelectorAll("[data-control-option]")],as=g("#operator-console"),vr=Object.freeze(["W","A","S","D","E","WAIT"]),ns=Object.freeze(["visual","hybrid","state"]),ls=new Set(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE","ArrowUp","ArrowDown","KeyI","KeyJ","KeyK","KeyL","KeyU","KeyO","Minus","Equal"]);function xr(){document.title=`${h.ui.brand} — 3D Robot Demo`,x.dataset.level=M,g("#brand-name").textContent=h.ui.brand,g("#unit-label").textContent=h.ui.unit,g("#system-label").textContent=h.ui.systemLabel,g("#cargo-label").textContent=h.ui.cargoLabel,g("#gate-label").textContent=h.ui.gateLabel,g("#start-kicker").textContent=h.ui.startKicker,g("#start-title").innerHTML=M==="rf15"?Tt:h.ui.startTitle,g("#start-copy").textContent=Tt,or.textContent=Tt,g("#terminal-heading-text").textContent=h.ui.terminalHeading,g("#complete-kicker").textContent=h.ui.completeKicker,g("#complete-title").textContent=h.ui.completeTitle,g("#complete-copy").textContent=h.ui.completeCopy,pr.forEach(t=>{const e=t.dataset.levelOption===M;t.classList.toggle("selected",e),e&&t.setAttribute("aria-current","page");const i=new URL(window.location.href);i.search="",i.searchParams.set("mode",ce==="agent"?"agent":"play"),i.searchParams.set("level",t.dataset.levelOption),i.searchParams.set("view",X),i.searchParams.set("robot",$),i.searchParams.set("control",k),t.href=i.toString()}),x.dataset.viewMode=X,x.dataset.controlMode=k,mr.forEach(t=>{const e=t.dataset.robotOption===$;t.classList.toggle("selected",e),t.setAttribute("aria-pressed",String(e))}),gr.forEach(t=>{const e=t.dataset.controlOption!=="joint"||$==="g1"&&!G,i=t.dataset.controlOption===k;t.disabled=!e,t.classList.toggle("selected",i),t.setAttribute("aria-pressed",String(i))}),hr.forEach(t=>{const e=t.dataset.viewOption===X;t.classList.toggle("selected",e),t.setAttribute("aria-pressed",String(e))})}xr();Ai.hidden=!Zo;Mi.hidden=!["play","agent"].includes(ce)||be;It.hidden=!0;x.dataset.pageMode=ce;const T=new Rr({antialias:!0,alpha:M==="rf10",powerPreference:"high-performance"});T.setPixelRatio(Math.min(window.devicePixelRatio,h.rendering?.pixelRatioCap??2));T.setSize(window.innerWidth,window.innerHeight);T.shadowMap.enabled=!0;T.shadowMap.type=ro;T.outputColorSpace=oo;T.toneMapping=Xi;T.toneMappingExposure=["rf02","rf02-2","rf02-3"].includes(M)?1.15:M==="rf03"?1.22:["rf04","rf04-2","rf04-3"].includes(M)?1.12:1.3;M==="rf10"&&(T.domElement.style.position="absolute",T.domElement.style.inset="0",T.domElement.style.zIndex="1");$o.append(T.domElement);const O=h.createScene(T),cs=["rf01","rf01-2","rf01-3"].includes(M)?ao(T,O.scene):Promise.resolve({loaded:!1}),ds=O.scene.fog?.near,us=O.scene.fog?.far,fs=O.scene.fog?.density,se=new Pt(h.camera.fov,window.innerWidth/window.innerHeight,.1,100),oe=J.supportsD435?Ut(new Pt):new Pt(64,window.innerWidth/window.innerHeight,.1,40),ge=G?Ut(new Pt):null,Ct=new F(...h.camera.position),Ne=new F(...h.camera.lookAt),Lt=Ct.clone().sub(Ne),wr=Math.max(.1,Lt.length());let Ot=Math.atan2(Lt.x,Lt.z),et=Math.asin(ve.clamp(Lt.y/wr,-1,1)),tt=1,gi=1;const yr=new F(0,1,0),hs=new F(-Ct.x,0,-Ct.z).normalize();new F().crossVectors(hs,yr).normalize();const Ee=new F,ji=new F,li=new F,Wi=new F,vi=["rf01","rf01-2","rf01-3"].includes(M)?No(T,O.scene,se):null;let z=Vo(),a=h.createInitialState(),Je=0,ze=0,At=0;const br=h.createCargoModel?.(),ps=Q.get("colliders")==="1",w=qi(br,{robotId:$,showCollision:ps});function ms(){const t=qi(null,{robotId:"r1",instanceId:"beta"});return t.name="unitree-r1-edu-beta-container",t}const K=G?ms():null,Ue=h.getRobotGroundY?.()??0,Ie=$==="g1"&&!G;let Rt=!1,it=null,Pe=null;const de=Ie?new ho({onState:t=>{it=t},onStatus:t=>{Rt=t==="online",Rt||(Pe=null),x.dataset.mujocoStatus=t,ne()}}):null;w.position.set(a.player.x,Ue,a.player.z);w.rotation.y=a.player.yaw;O.scene.add(w);K&&O.scene.add(K);Promise.allSettled([w.userData.assetReady,O.collisionReady]).then(([t,e])=>{if(!["rf01","rf01-2","rf01-3"].includes(M)||$!=="g1"||t.status!=="fulfilled"||e.status!=="fulfilled")return;const i=w.userData.collisionRig;!i||!e.value?.loaded||i.staticParts.length||(ir.staticColliders.forEach(s=>i.addStaticBox([(s.minX+s.maxX)/2,1.2,(s.minZ+s.maxZ)/2],[s.maxX-s.minX,2.4,s.maxZ-s.minZ],s.id)),x.dataset.g1CollisionReady="true",x.dataset.g1CollisionGeomCount=String(i.getCollisionSummary().total))});O.scene.add(oe);se.position.copy(Ct);se.lookAt(Ne);function xi(){const t=wr*gi*tt,e=Math.cos(et)*t;se.position.set(Ne.x+Math.sin(Ot)*e,Ne.y+Math.sin(et)*t,Ne.z+Math.cos(Ot)*e),se.far=Math.max(100,t+80);const i=gi*tt;O.scene.fog?.isFog?(O.scene.fog.near=ds*i,O.scene.fog.far=us*i):O.scene.fog?.isFogExp2&&(O.scene.fog.density=fs/i),se.lookAt(Ne)}function Pi(){const t=$i(X,window.innerWidth,window.innerHeight),e=t.find(r=>r.view==="third")??t[0];t.find(r=>r.view==="first")??t[0];const i=e.width/e.height;gi=G&&X==="dual"?.95:i<1?Math.min(3.35,1.5/i):1,se.aspect=i,se.updateProjectionMatrix(),xi(),J.supportsD435&&Ut(oe)}Pi();function gs(t){X=Ji(t,null);try{window.localStorage.setItem(er,X)}catch{}const e=new URL(window.location.href);e.searchParams.set("view",X),e.searchParams.set("robot",$),e.searchParams.set("control",k),window.history.replaceState(null,"",e),xr(),Pi(),Di?.refresh(),Ft()}const Nt=bo(se,O.scene,h.audio);O.assetReady.then(t=>{x.dataset.cardinalAssetsLoaded=String(t.filter(e=>e.loaded).length),x.dataset.cardinalAssetsTotal=String(t.length)});O.gaussianReady?.then(t=>{x.dataset.gaussianLoaded=String(t.loaded),x.dataset.gaussianLoadMs=t.loadMs.toFixed(1)});cs.then(t=>{x.dataset.environmentMapLoaded=String(t.loaded)});let ee=!1,Le=!1;Ce.disabled=!0;Ce.textContent=`正在加载 ${J.label}…`;x.dataset.robotAssetState="loading";const vs=window.setInterval(()=>{const t=Math.max(w.userData.loadAttempt,1),e=w.userData.loadState==="retrying";Ce.textContent=e?`正在重新加载 ${J.label}（${t}/3）…`:`正在加载 ${J.label}…`},200),xs=O.collisionReady??Promise.resolve({loaded:!0}),ws=br?.userData?.assetReady??Promise.resolve({loaded:!0});let te=null;const Sr=h.createInteractionAnimation&&k==="velocity"?Promise.all([w.userData.assetReady,O.assetReady]).then(async()=>(te=await h.createInteractionAnimation(O,w,{runtime:h,getState:()=>a,setState:t=>{a=t},stop:Oe,message:rt}),{loaded:!0})):$==="g1"&&k==="velocity"&&["rf15-1","rf15-2","rf15-3"].includes(M)?Promise.all([w.userData.assetReady,O.assetReady]).then(async()=>{const{createInteractionAnimation:t}=await b(async()=>{const{createInteractionAnimation:e}=await import("./interaction-animation-VuM4AYIO.js");return{createInteractionAnimation:e}},__vite__mapDeps([61,11,7,8,18,55,6,13]),import.meta.url);return te=await t(O,w,{runtime:h,controlMode:k,getState:()=>a,setState:e=>{a=e},stop:Oe,message:rt,robotFeedback:()=>it}),{loaded:!0}}):Promise.resolve({loaded:!0});Sr.catch(t=>{x.dataset.physicsError=String(t),console.error(t)});const ys=O.assetReady??Promise.resolve([{loaded:!0}]),bs=K?.userData?.assetReady??Promise.resolve({loaded:!0});Promise.allSettled([w.userData.assetReady,bs,xs,ws,ys,Sr]).then(([t,e,i,s,r,o])=>{const n=t.status==="fulfilled"?t.value:{loaded:!1,asset:UNITREE_G1_DEX1_GLB_URL,error:t.reason},l=i.status==="fulfilled"?i.value:{loaded:!1,error:i.reason},c=s.status==="fulfilled"?s.value:{loaded:!1,error:s.reason};window.clearInterval(vs);const u=(Array.isArray(c)?c.flat(1/0):[c]).every(R=>R?.loaded),E=(r.status==="fulfilled"&&Array.isArray(r.value)?r.value:[]).every(R=>R?.loaded)&&o.status==="fulfilled";ee=n.loaded&&(e.status!=="fulfilled"||e.value?.loaded!==!1)&&E,Le=!ee,x.dataset.robotModelLoaded=String(n.loaded),x.dataset.firstPersonRobotLoaded=String(n.loaded),x.dataset.robotAssetState=ee?"ready":"failed",x.dataset.robotAssetError=w.userData.loadError,x.dataset.collisionProxyLoaded=String(l.loaded),x.dataset.cargoAssetLoaded=String(u),x.dataset.requiredAssetsReady=String(ee&&l.loaded&&u),Ce.disabled=!1,Ce.innerHTML=ee?es:`${J.label} 加载失败 · 点击重试`,ee&&be&&nt()});const I=new Set;let Vt=null,Di=null,Y=!1,ue=!1,wi=performance.now(),Hi=0,yi=!1,bi=!1;const xe=t=>new Promise(e=>window.setTimeout(e,t));function rt(t){t&&(window.clearTimeout(Hi),ai.textContent=t,ai.classList.add("visible"),Hi=window.setTimeout(()=>ai.classList.remove("visible"),2200))}function Tr(){return Y&&!ue&&!a.complete&&!a.failed&&!a.terminalOpen}function zt(t,e){return ls.has(t)?(e&&Tr()?I.add(t):I.delete(t),Vt?.setPressed(t,e&&I.has(t)),I.has(t)):!1}function Oe(){I.clear(),Vt?.clearPressed()}function Ss(){Oe(),te?.cancel(),z=at(),rt("移动输入已停止"),ne()}function Ci({force:t=!1}={}){return Nt.stopAll(),z=at(),a=h.createInitialState(),Je=0,yi=!1,bi=!1,rr.hidden=!0,pi.hidden=!0,Ei.hidden=!0,w.position.set(a.player.x,Ue,a.player.z),w.rotation.y=a.player.yaw,it=null,Pe=null,de?.reset({x:a.player.x,z:a.player.z,yaw:a.player.yaw}),Oe(),te?.reset(),ne(),t||rt("模拟环境已重置"),!0}function Bt(){return Ci()}function Ts(){const t=h.getTelemetry(a);return{objective:Tt,reserve:Math.max(0,Math.round(a.progress)),cargo:t.cargo,system:t.system,gate:t.gate,result:a.complete?"success":a.failed?"failure":"running"}}function bt(t,e,i){const s=e.getBoundingClientRect();s.width<=0||s.height<=0||e.hidden||(t.save(),t.translate(s.left,s.top),t.beginPath(),t.rect(0,0,s.width,s.height),t.clip(),t.fillStyle="rgba(12, 18, 18, 0.88)",t.fillRect(0,0,s.width,s.height),t.strokeStyle="rgba(167, 188, 180, 0.42)",t.lineWidth=1,t.strokeRect(.5,.5,s.width-1,s.height-1),i(t,s.width,s.height),t.restore())}function As(t,e,i,s,r,o,n=2){const l=String(e||"").split(/\s+/);let c="",d=0;for(const u of l){const S=c?`${c} ${u}`:u;if(c&&t.measureText(S).width>r){if(t.fillText(c,i,s+d*o,r),c=u,d+=1,d>=n)return}else c=S}d<n&&c&&t.fillText(c,i,s+d*o,r)}function Ms(t){const e="#a9b8b1",i="#f3f7f4",s="#78d8a3";t.textBaseline="alphabetic",t.letterSpacing="0px",[document.querySelector(".controls-hint"),document.querySelector(".legacy-link")].forEach(r=>{const o=r?.getBoundingClientRect();!o||o.width<=0||o.height<=0||(t.fillStyle="rgba(8, 12, 12, 0.96)",t.fillRect(o.left,o.top,o.width,o.height))}),bt(t,document.querySelector(".top-hud"),(r,o,n)=>{r.fillStyle=e,r.font="600 11px system-ui, sans-serif",r.fillText(g("#unit-label").textContent,18,22,o*.3),r.fillStyle=i,r.font="700 17px system-ui, sans-serif",r.fillText(g("#brand-name").textContent,18,47,o*.3);const l=o*.39,c=Math.max(120,o*.24);r.fillStyle=e,r.font="600 11px system-ui, sans-serif",r.fillText("MISSION RESERVE",l,21),r.fillStyle=i,r.font="700 17px system-ui, sans-serif",r.textAlign="right",r.fillText(lr.textContent,l+c,22),r.textAlign="left",r.fillStyle="rgba(255,255,255,0.14)",r.fillRect(l,34,c,9),r.fillStyle=a.progress<=15?"#ef6b62":a.progress<=35?"#e6c45c":s,r.fillRect(l,34,c*Math.max(0,a.progress)/100,9),r.fillStyle=e,r.font="600 11px system-ui, sans-serif",r.fillText(g("#system-label").textContent,o*.75,22,o*.22),r.fillStyle=i,r.font="700 17px system-ui, sans-serif",r.fillText(mi.textContent,o*.75,47,o*.22)}),bt(t,document.querySelector(".mission-panel"),(r,o)=>{r.fillStyle=e,r.font="600 10px system-ui, sans-serif",r.fillText("CURRENT DIRECTIVE",18,24),r.fillStyle=i,r.font="700 20px system-ui, sans-serif",r.fillText(or.textContent,18,54,o-36)}),bt(t,document.querySelector(".telemetry-panel"),(r,o)=>{[["ROBOT STATE",sr.textContent],[g("#cargo-label").textContent,ar.textContent],[g("#gate-label").textContent,nr.textContent]].forEach(([l,c],d)=>{const u=24+d*38;r.fillStyle=e,r.font="600 10px system-ui, sans-serif",r.fillText(l,16,u,o*.48),r.fillStyle=i,r.font="700 12px system-ui, sans-serif",r.textAlign="right",r.fillText(c,o-16,u,o*.48),r.textAlign="left"})}),Ei.hidden||bt(t,document.querySelector(".terminal-card"),(r,o)=>{r.fillStyle=e,r.font="600 10px system-ui, sans-serif",r.fillText(g("#terminal-heading-text").textContent,20,27,o-40),r.fillStyle=i,r.font="700 22px system-ui, sans-serif",r.fillText(cr.textContent,20,62,o-40),r.fillStyle=e,r.font="400 12px system-ui, sans-serif",As(r,dr.textContent,20,88,o-40,17,3),fr.forEach((n,l)=>{r.fillStyle=i,r.font="600 11px system-ui, sans-serif",r.fillText(`${ur[l].textContent}: ${n.textContent}`,20,150+l*24,o-40)})})}function Es(){if(G){if(!di(w,oe.position,Ee))return;Ee.set(Math.sin(a.player.yaw),0,Math.cos(a.player.yaw));const t=new F(Math.cos(a.player.yaw),0,-Math.sin(a.player.yaw));Ee.applyAxisAngle(t,ze),oe.lookAt(oe.position.clone().add(Ee));return}if(!di(w,oe.position,Ee)){const t=w.userData?.officialModel?.userData?.sculptRuntime?.sockets?.camera;if(!t)return;t.updateWorldMatrix(!0,!1),oe.position.setFromMatrixPosition(t.matrixWorld),Ee.set(1,0,0).transformDirection(t.matrixWorld)}ji.copy(oe.position).add(Ee),oe.lookAt(ji)}function Ps(){if(!K||!ge)return;const e=K.userData?.model?.userData?.sculptRuntime?.sockets?.camera;if(e){const s=new so;e.getWorldPosition(ge.position),e.getWorldQuaternion(s),li.set(Math.sin(a.partner.yaw),0,Math.cos(a.partner.yaw)).normalize(),Wi.set(Math.cos(a.partner.yaw),0,-Math.sin(a.partner.yaw)).normalize(),li.applyAxisAngle(Wi,At),ge.lookAt(ge.position.clone().add(li));return}const i=new F;di(K,ge.position,i)&&ge.lookAt(ge.position.clone().add(i))}function Ft(){Es(),Ps();const t=window.innerWidth,e=window.innerHeight,i=G&&X==="dual"?(()=>{const o=Math.floor(t*.5),n=t-o,l=Math.floor(e*.5);return[{view:"first-alpha",x:0,y:l,width:o,height:e-l},{view:"first-beta",x:0,y:0,width:o,height:l},{view:"third",x:o,y:0,width:n,height:e}]})():$i(X,t,e),s=i.length>1,r=i.map(o=>o.view.startsWith("first")&&J.supportsD435?{...Fi(o,zi.aspect),view:o.view}:o);O.gaussianLayer?.syncViews(r,{first:oe,third:se}),i.forEach(o=>{const n=o.view.startsWith("first"),l=o.view==="first-beta",c=n&&J.supportsD435?Fi(o,zi.aspect):o;w.visible=!0;const d=n?l?ge:oe:se;G&&(w.visible=!0,K&&(K.visible=!0)),T.setScissorTest(s||n),n&&(T.setViewport(o.x,o.y,o.width,o.height),T.setScissor(o.x,o.y,o.width,o.height),T.setClearColor(M==="rf10"?0:329480,M==="rf10"?0:1),T.clear(!0,!0,!0)),T.setViewport(c.x,c.y,c.width,c.height),(s||n)&&T.setScissor(c.x,c.y,c.width,c.height),n&&J.supportsD435?Ut(d):(d.aspect=c.width/Math.max(1,c.height),d.updateProjectionMatrix());const u=l?K?.userData?.model?.userData?.sculptRuntime?.sockets?.head:null;u&&(u.visible=!1),n&&J.supportsD435&&(!l||!K?.userData?.model)&&Ui(w,!1);try{h.prepareView?.(O,{firstPerson:n}),vi&&!s&&!n?vi.render(d):T.render(O.scene,d)}finally{n&&J.supportsD435&&(!l||!K?.userData?.model)&&Ui(w,!0),u&&(u.visible=!0)}}),w.visible=!0,T.setScissorTest(!1),T.setViewport(0,0,t,e)}function Ar(){Ft();const t=Math.min(1600,window.innerWidth),e=Math.max(1,Math.round(t*window.innerHeight/window.innerWidth)),i=document.createElement("canvas");i.width=t,i.height=e;const s=i.getContext("2d",{alpha:!1});return s.drawImage(T.domElement,0,0,t,e),s.save(),s.scale(t/window.innerWidth,e/window.innerHeight),Ms(s),s.restore(),i.toDataURL("image/jpeg",.84)}function Ds(){Ft();const t=document.createElement("canvas");return t.width=T.domElement.width,t.height=T.domElement.height,t.getContext("2d",{alpha:!1}).drawImage(T.domElement,0,0),t.toDataURL("image/jpeg",.9)}function Cs(){return new Promise(t=>{let e=!1;const i=()=>{e||(e=!0,t())},s=window.setTimeout(i,1800);function r(){ae(z)?requestAnimationFrame(r):(window.clearTimeout(s),i())}r()})}function Ls(t=120){return Promise.race([new Promise(e=>requestAnimationFrame(()=>requestAnimationFrame(e))),xe(t)])}async function Os(t,e=300){if(["W","A","S","D"].includes(t)){const i={W:{move:1,strafe:0,turn:0},A:{move:0,strafe:1,turn:0},S:{move:-1,strafe:0,turn:0},D:{move:0,strafe:-1,turn:0}}[t];ue=!0;try{let s=e;for(;s>0;){const r=Math.min(.05,s/1e3);if(Y&&!a.complete&&!a.failed){const o=a.player.x,n=a.player.z,l=Ie&&k==="velocity"?vo(i,h.LEVEL):i;a=h.updateMovement(a,l,r),Je+=Math.hypot(a.player.x-o,a.player.z-n),w.position.set(a.player.x,Ue,a.player.z),w.rotation.y=a.player.yaw,h.syncRobotCargo?.(w,a),ne()}s-=r*1e3,await xe(r*1e3)}}finally{ue=!1}}else t==="E"?(jt(),ae(z)?await Cs():await xe(e)):t==="WAIT"&&await xe(e);await Ls()}let ci=Promise.resolve();function nt(t){if(t?.preventDefault(),t?.stopPropagation(),Le){const e=new URL(window.location.href);be||(e.search="",e.searchParams.set("mode",ce==="agent"?"agent":"play"),e.searchParams.set("level",M),e.searchParams.set("view",X),e.searchParams.set("robot",$),e.searchParams.set("control",k)),window.location.assign(e);return}if(!ee){rt("G1 EDU2 · MuJoCo 29DOF 模型尚未加载完成，当前禁止进入任务");return}if(Nt.unlock(),!be){const e=new URL(window.location.href);e.search="",e.searchParams.set("mode",ce==="agent"?"agent":"play"),e.searchParams.set("level",M),e.searchParams.set("view",X),e.searchParams.set("robot",$),e.searchParams.set("control",k);for(const i of["physics","qa"])Q.has(i)&&e.searchParams.set(i,Q.get(i));window.history.replaceState(null,"",e)}Y=!0,Ie&&(de.connect(),de.setControlMode(Yo),de.reset({x:a.player.x,z:a.player.z,yaw:a.player.yaw})),Ai.hidden=!0,Mi.hidden=!0,It.hidden=!["play","agent"].includes(ce)||be,wi=performance.now(),ne()}function Rs(){if(be)return;Y=!1,ue=!1,Ci({force:!0}),Ai.hidden=!0,Mi.hidden=!1,It.hidden=!0;const t=new URL(window.location.href);t.search="",t.searchParams.set("mode",ce==="agent"?"agent":"play"),t.searchParams.set("level",M),t.searchParams.set("view",X),t.searchParams.set("robot",$),t.searchParams.set("control",k),window.history.replaceState(null,"",t)}function Ns(){const t=h.getTerminal(a);cr.textContent=t.title,dr.textContent=t.copy,t.rows.forEach(([e,i],s)=>{ur[s].textContent=e,fr[s].textContent=i})}function ne(){const t=h.getTelemetry(a);mi.textContent=t.system,mi.classList.toggle("online",t.systemOnline),os.classList.toggle("online",t.systemOnline),sr.textContent=(G?`${a.motion.alpha}/${a.motion.beta}`:a.motion).toUpperCase(),ar.textContent=t.cargo,nr.textContent=t.gate;const e=Math.max(0,Math.round(a.progress));ss.style.width=`${a.progress}%`,lr.textContent=`${e}%`,ni.setAttribute("aria-valuenow",String(e)),ni.classList.toggle("warning",a.progress<=35&&a.progress>15),ni.classList.toggle("critical",a.progress<=15),x.classList.toggle("failed",a.failed),Ei.hidden=!a.terminalOpen,a.terminalOpen&&Ns(),x.dataset.playerX=a.player.x.toFixed(2),x.dataset.playerZ=a.player.z.toFixed(2),x.dataset.complete=String(a.complete),x.dataset.failed=String(a.failed),x.dataset.progress=a.progress.toFixed(2);const i=Dt(z,h.isCarrying(a));x.dataset.robotAction=z.kind,x.dataset.robotActionEvent=z.event??"",x.dataset.robotActionGesture=z.gesture??"idle",x.dataset.robotActionActive=String(z.active),x.dataset.robotActionProgress=i.progress.toFixed(3),x.dataset.robotActionContact=String(i.contactReached),Object.entries(h.getDebugState(a)).forEach(([r,o])=>{x.dataset[r]=typeof o=="object"?JSON.stringify(o):String(o)});const s=Tr();Vt?.update({controlEnabled:s,controlMode:k==="joint"?"29DOF AGENT":ue?"AGENT":s?"LOCAL":"STANDBY",motion:(G?`${a.motion.alpha}/${a.motion.beta}`:a.motion).toUpperCase(),input:k==="joint"?"JOINT API":ue?"AGENT":s?"READY":"LOCKED",feed:ue?"AGENT":Y?"RUNNING":"STANDBY",level:h.ui.levelLabel??M.toUpperCase()})}function jt(){if(!Y||a.complete||a.failed||ae(z))return!1;Nt.unlock();const t=a;if(te){const i=te.interact();if(i!==!1)return ne(),i}const e=a.interactions;return a=h.interact(a,G&&window.__RF11_INTERACTION_AGENT__||"alpha"),a.interactions!==e&&(z=Fo(z,a.lastEvent,t,a),Nt.playEvent(a.lastEvent,h.getSoundPosition(t,a))),ne(),a.interactions!==e}function Gi(){let t=0,e=0,i=0;return I.has("KeyW")&&(t+=1),I.has("KeyS")&&(t-=1),I.has("KeyA")&&(e+=1),I.has("KeyD")&&(e-=1),I.has("KeyQ")&&(i+=1),I.has("KeyE")&&(i-=1),G?{alpha:{move:t,strafe:e,turn:i,drain:t!==0||e!==0},beta:{move:(I.has("KeyI")?1:0)+(I.has("KeyK")?-1:0),strafe:(I.has("KeyJ")?1:0)+(I.has("KeyL")?-1:0),turn:(I.has("KeyU")?1:0)+(I.has("KeyO")?-1:0),drain:I.has("KeyI")||I.has("KeyK")||I.has("KeyJ")||I.has("KeyL")}}:{move:t,strafe:e,turn:i,drain:t!==0||e!==0}}function Mr(t){requestAnimationFrame(Mr);const e=Math.min((t-wi)/1e3,.05);wi=t,z=jo(z,e);const i=ae(z)?G?{alpha:{},beta:{}}:{move:0,strafe:0,turn:0,drain:!1}:te?.busy?te.motionInput(a,Gi())??{move:0,strafe:0,turn:0,drain:!1}:Gi();if(Y&&!ue&&!a.complete&&!a.failed){if(te?.busy)de?.setCommand({forward:0,lateral:0,yaw:0},M,{x:a.player.x,z:a.player.z,yaw:a.player.yaw}),a=h.updateMovement(a,i,e);else if(Ie&&Rt&&k==="velocity"){const d={forward:i.move||0,lateral:i.strafe||0,yaw:i.turn||0};de.setCommand(d,M,{x:a.player.x,z:a.player.z,yaw:a.player.yaw})}else if(!Ie){const d=a.player.x,u=a.player.z;a=h.updateMovement(a,i,e),Je+=Math.hypot(a.player.x-d,a.player.z-u)}}const s=Dt(z,h.isCarrying(a)),r=z.kind==="operate"&&!s.contactReached;Y&&!a.complete&&!a.failed&&h.updateEnvironment&&!r&&(a=h.updateEnvironment(a,e));const o=Dt(z,h.isCarrying(a)),n=Wo(z,a),l=Ie&&Rt?de.sample(t):null;if(l){const d={position:l.base.position,yaw:l.base.yaw};if(!Pe)Pe=d;else if(Y&&!ue&&!a.complete&&!a.failed){const u=mo(Pe,d,h.LEVEL,e,i);if(u&&!te?.busy&&(!te||i.move||i.strafe||i.turn)){const S=a.player.x,E=a.player.z;a=h.updateMovement(a,{...u,passiveMotion:!i.move&&!i.strafe},e),Je+=Math.hypot(a.player.x-S,a.player.z-E)}Pe=d}else Pe=d;go(w,l,J,{groundY:Ue,lookPitch:ze,projectWorldPose:!1}),(ae(z)||o.visualCarrying)&&no(w,o),w.position.set(a.player.x,w.position.y,a.player.z),w.quaternion.setFromAxisAngle(yr,a.player.yaw),w.userData.collisionRig?.sync({step:w.userData.collisionRig.ownsWorld})}else w.position.set(a.player.x,Ue,a.player.z),w.rotation.y=a.player.yaw;K&&(K.position.set(a.partner.x,Ue,a.partner.z),K.rotation.y=a.partner.yaw),(M==="rf01"||M==="rf01-2")&&lo(w,o,a,z),h.syncRobotCargo?.(w,n);const c=(I.has("ArrowUp")?1:0)-(I.has("ArrowDown")?1:0);if(ze=ve.clamp(ze+c*ve.degToRad(28)*e,pt.minimumRadians,pt.maximumRadians),G){const d=(I.has("Equal")?1:0)-(I.has("Minus")?1:0);At=ve.clamp(At+d*ve.degToRad(28)*e,pt.minimumRadians,pt.maximumRadians)}if(l||co(w,e,a.elapsed,G?a.motion.alpha:a.motion,o,Je,ze),K?.userData?.model&&uo(K.userData.model,e,a.elapsed,a.motion.beta,null,At),h.syncVisuals(O,n,e),te?.frame(e,Y&&!a.complete&&!a.failed),a.complete&&!yi&&!ae(z)&&(yi=!0,window.setTimeout(()=>{rr.hidden=!1},550)),a.failed&&!bi){bi=!0,Oe(),z=at();const d=h.getFailureMessage?.(a);d&&(pi.querySelector("p").textContent=d),pi.hidden=!1}ne(),Ft()}window.addEventListener("keydown",t=>{["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE","KeyF","KeyR","ArrowUp","ArrowDown","Escape","KeyI","KeyJ","KeyK","KeyL","KeyU","KeyO","KeyH","Minus","Equal"].includes(t.code)&&t.preventDefault(),(t.code==="KeyF"||G&&t.code==="KeyH")&&!t.repeat?(window.__RF11_INTERACTION_AGENT__=t.code==="KeyH"?"beta":"alpha",jt()):t.code==="KeyR"&&!t.repeat?Bt():t.code==="Escape"&&a.terminalOpen?(a=h.closeTerminal(a),ne()):zt(t.code,!0)});window.addEventListener("keyup",t=>zt(t.code,!1));window.addEventListener("blur",()=>{Oe(),z=at()});document.addEventListener("visibilitychange",()=>{document.hidden&&(Oe(),z=at())});window.addEventListener("resize",()=>{T.setPixelRatio(Math.min(window.devicePixelRatio,h.rendering?.pixelRatioCap??2)),T.setSize(window.innerWidth,window.innerHeight),vi?.setSize(window.innerWidth,window.innerHeight),Pi()});Ce.addEventListener("click",nt);It.addEventListener("click",Rs);pr.forEach(t=>{t.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation();const i=new URL(window.location.href);i.search="",i.searchParams.set("mode",ce==="agent"?"agent":"play"),i.searchParams.set("level",t.dataset.levelOption),i.searchParams.set("view",X),i.searchParams.set("robot",$),i.searchParams.set("control",k),window.location.assign(i.toString())})});ts.addEventListener("click",Bt);is.addEventListener("click",Bt);rs.addEventListener("click",jt);hr.forEach(t=>{t.addEventListener("click",()=>gs(t.dataset.viewOption))});mr.forEach(t=>{t.addEventListener("click",()=>{const e=new URL(window.location.href),i=_i(t.dataset.robotOption).id;e.searchParams.set("robot",i),i!=="g1"&&e.searchParams.set("control","velocity"),window.location.assign(e.toString())})});gr.forEach(t=>{t.addEventListener("click",()=>{if(t.disabled)return;const e=new URL(window.location.href);e.searchParams.set("control",t.dataset.controlOption),window.location.assign(e.toString())})});Vt=Ho({root:as,pressControl:t=>zt(t,!0),releaseControl:t=>zt(t,!1),interact:jt,reset:Bt,stop:Ss});Di=_o({element:T.domElement,shell:x,getViewMode:()=>X,onOrbit:({yaw:t,pitch:e})=>{Ot+=t,et=ve.clamp(et+e,ve.degToRad(12),ve.degToRad(86)),xi()},onZoom:t=>{tt=Xo(tt,t),xi()}});ne();requestAnimationFrame(Mr);window.__RELAY_DEMO__={getState:()=>structuredClone(a),getRobotAction:()=>structuredClone(z),getInteraction:()=>h.getInteraction?.(a)??null,captureFrame:Ar,level:ir,levelId:M,getViewMode:()=>X,getThirdPersonView:()=>({yaw:Ot,pitch:et,zoom:tt,interaction:Di?.getState()??null}),getD435LookPitch:()=>ze,getMujocoState:()=>it?structuredClone(it):null,getControlMode:()=>k,getJointOrder:()=>po,setJointTargets:(t,e=100)=>{if(k!=="joint"||!de)throw new Error("当前关卡没有启用 G1 29DOF Agent 控制");return de.setJointTargets(t,e),!0}};function Wt(){return a.complete?"WIN":a.failed?"GAME_OVER":"NOT_FINISHED"}function ot(t="hybrid",e=null){if(!ns.includes(t))throw new Error(`不支持的 Harness：${t}`);const i=h.getDebugState(a),s={protocolVersion:"arc-env-v1",observedAt:new Date().toISOString(),gameId:`${M}-v1`,level:M,view:X,harness:t,ready:ee&&!Le,status:Wt(),availableActions:vr,hud:Ts(),actionResult:e};return t!=="state"&&(s.screenshot=Ar()),t==="hybrid"&&(s.player=structuredClone(a.player),s.motion=a.motion,s.lastEvent=a.lastEvent,s.interaction=h.getInteraction?.(a)??null,s.debug=structuredClone(i)),t==="state"&&(s.state=structuredClone(a),s.interaction=h.getInteraction?.(a)??null,s.debug=structuredClone(i)),s}async function Er(t,e=300,i="hybrid"){const s=String(t||"").toUpperCase();if(!vr.includes(s))throw new Error(`非法动作：${s}`);if(!ee||Le)throw new Error("G1 EDU2 · MuJoCo 29DOF 模型尚未加载完成");const r=Math.min(1e3,Math.max(50,Number(e)||300)),o=async()=>{if(Y||nt(),!Y)return;const n={x:a.player.x,z:a.player.z,yaw:a.player.yaw,interactions:a.interactions};await Os(s,r);const l=a.interactions!==n.interactions,c={action:s,durationMs:r,event:l?a.lastEvent:s==="E"?"no_interaction":"executed",moved:Math.hypot(a.player.x-n.x,a.player.z-n.z),turned:Math.abs(a.player.yaw-n.yaw),status:Wt()};return ot(i,c)};return ci=ci.then(o,o),ci}window.__ARC_AGENT__=Object.freeze({protocolVersion:"arc-env-v1",ready:()=>({ready:ee&&!Le,assetState:x.dataset.robotAssetState||"loading",level:M,view:X}),observe:(t="hybrid")=>ot(t),act:({action:t,durationMs:e=300,harness:i="hybrid"})=>Er(t,e,i),reset:({harness:t="hybrid"}={})=>(Ci({force:!0}),Y||nt(),ot(t,{action:"RESET",event:"environment_reset",status:Wt()})),getState:()=>structuredClone(a)});async function zs(){const t=Q.get("episode"),e=Q.get("browser_token");if(!t||!e)return;x.dataset.agentEpisode=t;const i=`/api/v1/episodes/${encodeURIComponent(t)}`,s=async(n,l={})=>{const c=n.includes("?")?"&":"?",d=await fetch(`${i}/${n}${c}browser_token=${encodeURIComponent(e)}`,{cache:"no-store",...l,headers:{"content-type":"application/json",...l.headers||{}}});if(!d.ok&&d.status!==204){const u=await d.json().catch(()=>({}));throw new Error(u.error||`Episode API 返回 ${d.status}`)}return d},r=async n=>{let l=500;for(;;)try{const c=await s("observations",{method:"POST",body:JSON.stringify(n)});return delete x.dataset.agentBridgeError,c}catch(c){x.dataset.agentBridgeError=`观察回传失败，正在重试：${c.message}`,await xe(l),l=Math.min(5e3,l*2)}};for(;!ee&&!Le;)await xe(250);if(!Y&&ee&&!Le&&nt(),!Y){x.dataset.agentBridgeError="游戏尚未进入运行状态";return}const o=Q.get("harness")||"hybrid";for(await r({observation:ot(o)});;)try{const n=await s("commands/next");if(n.status===204){await xe(300);continue}const l=await n.json();let c;l.kind==="act"?c=await Er(l.payload.action,l.payload.durationMs,o):l.kind==="reset"?c=window.__ARC_AGENT__.reset({harness:o}):c=ot(o,{action:"OBSERVE",event:"observed",status:Wt()}),await r({commandId:l.id,observation:c})}catch(n){x.dataset.agentBridgeError=n.message,await xe(1e3)}}zs();Q.get("qaCapture")==="1"&&window.setTimeout(()=>{const t=new Image;t.id="qa-captured-frame",t.alt="RF-01 QA captured frame",t.src=Ds(),t.hidden=!0,document.body.append(t)},6e3);
