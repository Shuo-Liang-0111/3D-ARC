from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import time
import uuid
from dataclasses import dataclass, field

from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from level_environment import LevelEnvironments

from g1_simulation import (
    CONTROL_MODES,
    JOINT_ORDER,
    G1Paths,
    G1Resources,
    G1Simulation,
    POLICY_HZ,
    STREAM_HZ,
)


LOGGER = logging.getLogger("arc.mujoco")


@dataclass
class ServiceMetrics:
    started_at: float = field(default_factory=time.monotonic)
    active_sessions: int = 0
    total_sessions: int = 0
    total_policy_steps: int = 0
    total_states: int = 0
    policy_step_seconds: float = 0.0

    def snapshot(self, max_sessions: int) -> dict:
        uptime = max(time.monotonic() - self.started_at, 1e-9)
        mean_step_ms = (
            self.policy_step_seconds / self.total_policy_steps * 1000.0
            if self.total_policy_steps
            else 0.0
        )
        return {
            "activeSessions": self.active_sessions,
            "maxSessions": max_sessions,
            "totalSessions": self.total_sessions,
            "totalPolicySteps": self.total_policy_steps,
            "totalStates": self.total_states,
            "meanPolicyStepMs": mean_step_ms,
            "policyStepsPerSecond": self.total_policy_steps / uptime,
            "uptimeSeconds": uptime,
        }


class MujocoService:
    def __init__(self, resources: G1Resources, max_sessions: int):
        self.resources = resources
        self.environments = LevelEnvironments(resources)
        self.max_sessions = max_sessions
        self.capacity = asyncio.Semaphore(max_sessions)
        self.metrics = ServiceMetrics()

    async def handler(self, websocket: ServerConnection) -> None:
        if websocket.request.path != "/ws":
            await websocket.close(1008, "unsupported path")
            return
        if self.capacity.locked():
            await websocket.close(1013, "simulation capacity reached")
            return
        async with self.capacity:
            session_id = uuid.uuid4().hex
            simulation = G1Simulation(self.resources)
            self.metrics.active_sessions += 1
            self.metrics.total_sessions += 1
            LOGGER.info("session %s connected", session_id)
            await websocket.send(
                json.dumps(
                    {
                        "type": "hello",
                        "sessionId": session_id,
                        "robot": "g1-edu2-29dof",
                        "controller": "unitree-rl-lab-velocity-v0",
                        "controlMode": simulation.control_mode,
                        "controlModes": CONTROL_MODES,
                        "jointOrder": JOINT_ORDER,
                        "controllerHz": POLICY_HZ,
                        "streamHz": STREAM_HZ,
                        "maxSessions": self.max_sessions,
                    }
                )
            )
            receiver = asyncio.create_task(
                self._receive(websocket, simulation, session_id)
            )
            simulator = asyncio.create_task(
                self._simulate(websocket, simulation)
            )
            try:
                done, pending = await asyncio.wait(
                    (receiver, simulator), return_when=asyncio.FIRST_COMPLETED
                )
                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)
                for task in done:
                    exception = task.exception()
                    if exception and not isinstance(exception, ConnectionClosed):
                        raise exception
            except ConnectionClosed:
                pass
            finally:
                self.metrics.active_sessions -= 1
                LOGGER.info("session %s disconnected", session_id)

    async def _receive(
        self,
        websocket: ServerConnection,
        simulation: G1Simulation,
        session_id: str,
    ) -> None:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except (json.JSONDecodeError, TypeError):
                await websocket.send(json.dumps({"type": "error", "error": "invalid-json"}))
                continue
            if not isinstance(message, dict):
                await websocket.send(json.dumps({"type": "error", "error": "invalid-message"}))
                continue
            message_type = message.get("type")
            if message_type == "command":
                velocity = message.get("velocity") or {}
                if not isinstance(velocity, dict):
                    await self._send_command_error(websocket, "velocity must be an object")
                    continue
                try:
                    if "level" in message:
                        self.environments.apply(simulation, message["level"])
                    simulation.set_command(
                        velocity.get("forward", 0.0),
                        velocity.get("lateral", 0.0),
                        velocity.get("yaw", 0.0),
                    )
                except (TypeError, ValueError) as error:
                    await self._send_command_error(websocket, str(error))
            elif message_type == "control_mode":
                try:
                    simulation.set_control_mode(message.get("mode"))
                except (TypeError, ValueError) as error:
                    await self._send_command_error(websocket, str(error))
                    continue
                await websocket.send(
                    json.dumps(
                        {
                            "type": "control_mode",
                            "mode": simulation.control_mode,
                            "jointOrder": JOINT_ORDER,
                        }
                    )
                )
            elif message_type == "joint_command":
                if message.get("jointOrder") != JOINT_ORDER:
                    await self._send_command_error(
                        websocket,
                        f"jointOrder must be {JOINT_ORDER}",
                    )
                    continue
                try:
                    clipped = simulation.set_joint_targets(
                        message.get("targets"),
                        message.get("durationMs", 100),
                    )
                except (TypeError, ValueError) as error:
                    await self._send_command_error(websocket, str(error))
                    continue
                await websocket.send(
                    json.dumps(
                        {
                            "type": "joint_command",
                            "accepted": True,
                            "clipped": clipped,
                            "sequence": message.get("sequence"),
                        }
                    )
                )
            elif message_type == "reset":
                if "level" in message:
                    self.environments.apply(simulation, message["level"])
                simulation.reset(message.get("spawn"))
                await websocket.send(
                    json.dumps({"type": "reset", "sequence": simulation.sequence})
                )
            elif message_type == "stop":
                simulation.stop()
            elif message_type == "ping":
                await websocket.send(
                    json.dumps(
                        {
                            "type": "pong",
                            "clientTime": message.get("clientTime"),
                            "serverTime": time.time() * 1000.0,
                        }
                    )
                )
            elif message_type == "performance":
                await websocket.send(
                    json.dumps(
                        {
                            "type": "performance",
                            "sessionId": session_id,
                            **self.metrics.snapshot(self.max_sessions),
                        }
                    )
                )
            else:
                await websocket.send(
                    json.dumps({"type": "error", "error": "unsupported-message"})
                )

    async def _send_command_error(
        self,
        websocket: ServerConnection,
        detail: str,
    ) -> None:
        await websocket.send(
            json.dumps(
                {
                    "type": "error",
                    "error": "invalid-command",
                    "detail": detail,
                }
            )
        )

    async def _simulate(
        self,
        websocket: ServerConnection,
        simulation: G1Simulation,
    ) -> None:
        policy_period = 1.0 / POLICY_HZ
        stream_period = 1.0 / STREAM_HZ
        next_policy_at = time.monotonic()
        next_stream_at = next_policy_at
        simulated_seconds = 0.0
        wall_started_at = next_policy_at
        while True:
            now = time.monotonic()
            if now < next_policy_at:
                await asyncio.sleep(next_policy_at - now)
            step_started_at = time.monotonic()
            simulation.step()
            step_finished_at = time.monotonic()
            self.metrics.total_policy_steps += 1
            self.metrics.policy_step_seconds += step_finished_at - step_started_at
            simulated_seconds += policy_period
            next_policy_at += policy_period
            if step_finished_at - next_policy_at > policy_period * 2:
                next_policy_at = step_finished_at
            if step_finished_at >= next_stream_at:
                wall_seconds = max(step_finished_at - wall_started_at, 1e-9)
                state = simulation.state(simulated_seconds / wall_seconds)
                await websocket.send(json.dumps(state, separators=(",", ":")))
                self.metrics.total_states += 1
                next_stream_at += stream_period
                if step_finished_at - next_stream_at > stream_period * 2:
                    next_stream_at = step_finished_at


async def run() -> None:
    host = os.environ.get("ARC_MUJOCO_HOST", "127.0.0.1")
    port = int(os.environ.get("ARC_MUJOCO_PORT", "4186"))
    max_sessions = max(1, int(os.environ.get("ARC_MUJOCO_MAX_SESSIONS", "12")))
    resources = G1Resources(G1Paths.from_environment())
    service = MujocoService(resources, max_sessions)
    stop = asyncio.get_running_loop().create_future()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        asyncio.get_running_loop().add_signal_handler(
            signal_name,
            lambda: stop.done() or stop.set_result(None),
        )
    async with serve(
        service.handler,
        host,
        port,
        compression=None,
        max_size=64 * 1024,
        ping_interval=20,
        ping_timeout=20,
    ):
        LOGGER.info(
            "ARC MuJoCo service listening on ws://%s:%s/ws (max sessions: %s)",
            host,
            port,
            max_sessions,
        )
        await stop


if __name__ == "__main__":
    logging.basicConfig(
        level=os.environ.get("ARC_MUJOCO_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(run())
