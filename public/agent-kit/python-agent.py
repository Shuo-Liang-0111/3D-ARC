#!/usr/bin/env python3
"""Generic ARC agent using only the Python standard library.

Required environment variables:
  ARC_AGENT_API_URL, MODEL_API_URL, MODEL_API_KEY, MODEL_NAME

Optional:
  ARC_LEVEL=rf01, ARC_VIEW=dual, ARC_HARNESS=state, ARC_SEED=42
"""

from datetime import datetime
import http.client
import json
import os
from pathlib import Path
import queue
import re
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request


def seed_from_environment(value):
    if value is None:
        return None
    if not re.fullmatch(r"[0-9]+", value):
        raise ValueError("ARC_SEED must be an integer from 0 through 4294967295.")
    seed = int(value)
    if seed > 4294967295:
        raise ValueError("ARC_SEED must be an integer from 0 through 4294967295.")
    return seed


ARC_URL = os.environ["ARC_AGENT_API_URL"].rstrip("/")
MODEL_URL = os.environ["MODEL_API_URL"]
MODEL_KEY = os.environ["MODEL_API_KEY"]
MODEL_NAME = os.environ["MODEL_NAME"]
LEVEL = os.getenv("ARC_LEVEL", "rf01")
VIEW = os.getenv("ARC_VIEW", "dual")
HARNESS = os.getenv("ARC_HARNESS", "state")
SEED = seed_from_environment(os.environ.get("ARC_SEED"))
ACTIONS = {"W", "A", "S", "D", "E", "TURN_LEFT", "TURN_RIGHT", "WAIT"}
RETRY_DELAYS = [2, 5, 10, 20, 30]
browser_session = None


def browser_environment():
    return {name: value for name, value in os.environ.items()
            if not re.search(r"KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|^(MODEL|OPENAI|GEILI|ANTHROPIC|AZURE_OPENAI)_", name, re.I)}


class ManagedBrowser:
    @staticmethod
    def infrastructure_error():
        return RuntimeError(
            "Managed browser infrastructure failed. Install Node.js, puppeteer-core and Chromium; "
            "check NODE_BINARY, ARC_MANAGED_BROWSER_SCRIPT, ARC_CHROMIUM_EXECUTABLE and ARC_PUPPETEER_ENTRY. "
            "No screenshot fallback is available."
        )

    def __init__(self, game_url):
        candidates = [Path(__file__).with_name("arc-managed-browser.mjs"),
                      Path(__file__).resolve().parents[2] / "tools" / "arc-managed-browser.mjs"]
        script = os.getenv("ARC_MANAGED_BROWSER_SCRIPT") or next((str(path) for path in candidates if path.is_file()), None)
        self.process = None
        self.signal_handlers = {}
        if not script or not Path(script).is_file():
            raise self.infrastructure_error()
        try:
            self.process = subprocess.Popen(
                [os.getenv("NODE_BINARY", "node"), script, "--game-url-stdin"],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                text=True, encoding="utf-8", env=browser_environment(),
            )
            for sig in (signal.SIGINT, signal.SIGTERM):
                self.signal_handlers[sig] = signal.getsignal(sig)
                signal.signal(sig, self.stop_signal)
            ready = queue.Queue()
            threading.Thread(target=lambda: ready.put(self.process.stdout.readline()), daemon=True).start()
            self.process.stdin.write(game_url + "\n")
            self.process.stdin.flush()
            message = json.loads(ready.get(timeout=180))
            if message.get("ready") is not True:
                raise self.infrastructure_error()
        except Exception:
            self.close()
            raise self.infrastructure_error() from None

    def stop_signal(self, signum, _frame):
        self.close()
        raise SystemExit(128 + signum)

    def assert_running(self):
        if self.process.poll() is not None:
            raise self.infrastructure_error()

    def close(self):
        for sig, handler in self.signal_handlers.items():
            signal.signal(sig, handler)
        self.signal_handlers.clear()
        if not self.process:
            return
        try:
            self.process.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.process.stdout.close()


class RequestError(RuntimeError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def timing(label, started_at, details=""):
    elapsed_ms = round((time.perf_counter() - started_at) * 1000)
    print(f"TIMING {label} elapsedMs={elapsed_ms} {details}".rstrip(), flush=True)


def is_transient(error):
    return error.status is None or error.status in {408, 429} or error.status >= 500


def request_json(url, method="GET", token=None, body=None, model_request=False):
    headers = {"accept": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        headers["content-type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    retry_safe = method == "GET" or model_request
    for attempt in range(len(RETRY_DELAYS) + 1):
        started_at = time.perf_counter()
        outcome = "error"
        try:
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    if response.status == 204:
                        payload = None
                    else:
                        try:
                            payload = json.loads(response.read().decode("utf-8", errors="replace"))
                        except json.JSONDecodeError:
                            payload = {}
            except urllib.error.HTTPError as error:
                error.close()
                raise RequestError(f"HTTP {error.code}", error.code) from None
            except (urllib.error.URLError, OSError, http.client.HTTPException):
                raise RequestError("Request transport failed or timed out.") from None
            outcome = "ok"
            return payload
        except RequestError as error:
            if not retry_safe or not is_transient(error):
                raise
            if attempt >= len(RETRY_DELAYS):
                label = "Model" if model_request else "ARC read"
                raise RequestError(
                    f"{label} request failed after {attempt + 1} attempts; "
                    "check connectivity and service availability before resuming.", error.status,
                ) from None
            label = "model" if model_request else "read"
            print(f"Transient {label} request failure; retrying in {RETRY_DELAYS[attempt]}s.", flush=True)
        finally:
            if model_request:
                timing("model_request", started_at, f"attempt={attempt + 1} outcome={outcome}")
        time.sleep(RETRY_DELAYS[attempt])


def episode_request(episode_id, token, resource, method="GET", body=None):
    if browser_session:
        browser_session.assert_running()
    return request_json(f"{ARC_URL}/api/v1/episodes/{episode_id}/{resource}", method, token, body)


def wait_for_browser(episode_id, token):
    reported = False
    while True:
        try:
            return episode_request(episode_id, token, "observations/latest")
        except RequestError as error:
            if error.status != 409:
                raise
            if not reported:
                print(
                    f"Episode {episode_id}: waiting for the game browser to connect. "
                    "Keep its host awake; model inference has not started.", flush=True,
                )
                reported = True
            time.sleep(0.5)


def browser_connection(status):
    if status.get("status") == "waiting_for_browser" or ("lastSeenAt" in status and status["lastSeenAt"] is None):
        return "Browser has not connected. Open the original Episode game URL and keep its host awake."
    try:
        last_seen = datetime.fromisoformat(status["lastSeenAt"].replace("Z", "+00:00")).timestamp()
    except (KeyError, TypeError, ValueError, AttributeError):
        return "Browser connection is not confirmed by status."
    if time.time() - last_seen > 90:
        return "Browser heartbeat is stale; the game browser or its connection may be paused. Check the browser host and keep it awake."
    return "Browser heartbeat is recent."


def latest_for_command(episode_id, token):
    try:
        return episode_request(episode_id, token, "observations/latest")
    except RequestError as error:
        if error.status == 409:
            return None
        raise


def command_finished(observation, command_id):
    return observation and (observation.get("commandId") == command_id or observation.get("status") in {"WIN", "GAME_OVER"})


def wait_for_command(episode_id, token, command_id):
    window = 0
    while True:
        window += 1
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            observation = latest_for_command(episode_id, token)
            if command_finished(observation, command_id):
                return observation
            time.sleep(0.25)
        print(
            f"Episode {episode_id}: command {command_id} wait window {window} expired; "
            "checking command delivery and browser connection.", flush=True,
        )
        status = episode_request(episode_id, token, "status")
        latest = latest_for_command(episode_id, token)
        if command_finished(latest, command_id):
            return latest
        connection = browser_connection(status)
        active = status.get("activeCommand") or {}
        if active.get("id") == command_id:
            print(
                f"Episode {episode_id}: {connection} Command {command_id} is still active; "
                "continuing another 90s window without resending or requesting another model decision.", flush=True,
            )
            continue
        raise RuntimeError(
            f"Episode {episode_id}: command {command_id} delivery is uncertain after checking status and latest observation. "
            f"{connection} No action was resent; inspect this Episode before resuming."
        )


def model_content(observation, memory):
    screenshot = observation.get("screenshot")
    if HARNESS == "visual":
        if not screenshot:
            raise RuntimeError("Visual harness requires a screenshot before model inference.")
        descriptions = observation.get("actionDescriptions") or {}
        copy = {"actionDescriptions": {
            action: description for action, description in descriptions.items()
            if action in ACTIONS and isinstance(description, str)
        }}
    else:
        copy = dict(observation)
        copy.pop("screenshot", None)
    text = json.dumps({"observation": copy, "memory": memory}, ensure_ascii=False)
    if not screenshot:
        return text
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": screenshot}},
    ]


def act_and_observe(episode_id, token, action, duration_ms, previous):
    started_at = time.perf_counter()
    outcome = "error"
    try:
        try:
            command = episode_request(
                episode_id, token, "commands", "POST",
                {"kind": "act", "action": action, "durationMs": duration_ms},
            )
            if not isinstance(command, dict) or not command.get("id"):
                raise RequestError("Command acknowledgment was incomplete.")
        except RequestError as error:
            if not is_transient(error) and error.status != 409:
                raise
            # A lost POST response may hide a successful action. Never replay it blindly.
            status = episode_request(episode_id, token, "status")
            latest = episode_request(episode_id, token, "observations/latest")
            if (latest.get("status") in {"WIN", "GAME_OVER"}
                    or (latest.get("commandId") and latest.get("commandId") != previous.get("commandId"))):
                outcome = "recovered"
                return latest
            active = status.get("activeCommand") or {}
            if active.get("id"):
                observation = wait_for_command(episode_id, token, active["id"])
                outcome = "recovered"
                return observation
            raise RuntimeError(
                f"Episode {episode_id}: Action delivery is uncertain after checking status and latest observation. "
                f"{browser_connection(status)} No action was resent; inspect this Episode before resuming."
            ) from None
        observation = wait_for_command(episode_id, token, command["id"])
        outcome = "ok"
        return observation
    except Exception as error:
        if f"Episode {episode_id}:" in str(error):
            raise
        raise RuntimeError(
            f"Episode {episode_id}: {error} No action was resent; inspect this Episode before resuming."
        ) from None
    finally:
        timing("action_ack", started_at, f"action={action} durationMs={duration_ms} outcome={outcome}")


def parse_model_json(content):
    if isinstance(content, list):
        content = "".join(
            part["text"] for part in content
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        )
    try:
        result = json.loads(content)
    except (TypeError, ValueError):
        raise ValueError("Return strict JSON with action and durationMs.") from None
    if not isinstance(result, dict):
        raise ValueError("The decision must be a JSON object.")
    action = result.get("action")
    if not isinstance(action, str) or action not in ACTIONS:
        raise ValueError("action must be one of W,A,S,D,E,TURN_LEFT,TURN_RIGHT,WAIT.")
    duration_ms = result.get("durationMs")
    if (isinstance(duration_ms, bool) or not isinstance(duration_ms, (int, float))
            or not 50 <= duration_ms <= 1000):
        raise ValueError("durationMs must be a number from 50 through 1000 milliseconds.")
    return action, duration_ms, result.get("memory")


def choose_action(observation, memory):
    messages = [
        {
            "role": "system",
            "content": (
                "You control a robot in ARC. Choose exactly one action from W,A,S,D,E,TURN_LEFT,TURN_RIGHT,WAIT. "
                "W moves forward; S moves backward; A strafes left; D strafes right; "
                "TURN_LEFT and TURN_RIGHT rotate heading; E interacts (legacy E always means interaction); WAIT applies no input. "
                "Follow the published actionDescriptions. In visual mode use only the current screenshot, published action descriptions, "
                "and your own memory. Keep memory concise. Choose its durationMs from 50 through 1000 milliseconds based on the observation and your plan. "
                "Use observation and memory, avoid repeating failed moves, and stop planning after WIN or GAME_OVER. "
                "Return strict JSON with action, durationMs, and optional memory. "
                "action must be one of the listed strings; durationMs must be a JSON number, not a string. "
                "There is no action-count limit; continue until WIN or GAME_OVER."
            ),
        },
        {"role": "user", "content": model_content(dict(observation), memory)},
    ]
    validation_error = None
    while True:
        if browser_session:
            browser_session.assert_running()
        retry_messages = messages
        if validation_error:
            retry_messages = messages + [{
                "role": "user",
                "content": (
                    f"Your previous response was invalid: {validation_error} "
                    "Choose again using the same observation. No action has been sent."
                ),
            }]
        response = request_json(
            MODEL_URL,
            "POST",
            body={"model": MODEL_NAME, "temperature": 0, "messages": retry_messages},
            token=MODEL_KEY,
            model_request=True,
        )
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            content = None
        try:
            return parse_model_json(content)
        except ValueError as error:
            validation_error = str(error)
            print(f"Invalid model decision: {validation_error} Retrying the same observation.", flush=True)


def main():
    global browser_session
    created = request_json(
        f"{ARC_URL}/api/v1/episodes",
        "POST",
        body={"level": LEVEL, "view": VIEW, "harness": HARNESS, **({"seed": SEED} if SEED is not None else {})},
    )
    episode_id = created["episode"]["id"]
    token = created["agentToken"]
    try:
        if HARNESS in {"visual", "hybrid"}:
            print(f"Episode {episode_id}: starting managed browser.", flush=True)
            browser_session = ManagedBrowser(created["gameUrl"])
            print(f"Episode {episode_id}: managed browser ready; original viewport PNG capture enabled.", flush=True)
        else:
            print("\nOpen this game URL in a browser:\n")
            print(created["gameUrl"], "\n", flush=True)
        observation = wait_for_browser(episode_id, token)

        step = 0
        own_memory = {}
        while True:
            status = observation.get("status")
            if status in {"WIN", "GAME_OVER"}:
                print(f"Episode finished: {status} after {step} actions")
                return
            started_at = time.perf_counter()
            outcome = "error"
            try:
                memory = own_memory if HARNESS == "visual" else episode_request(episode_id, token, "memory")
                action, duration_ms, memory_patch = choose_action(observation, memory)
                if isinstance(memory_patch, dict):
                    episode_request(episode_id, token, "memory", "PATCH", memory_patch)
                    own_memory = {**own_memory, **memory_patch}
                print(f"{step + 1:03d}  {action}  {duration_ms}ms", flush=True)
                observation = act_and_observe(episode_id, token, action, duration_ms, observation)
                outcome = "ok"
            finally:
                timing("step", started_at, f"step={step + 1} outcome={outcome}")
            step += 1
    finally:
        if browser_session:
            browser_session.close()
            browser_session = None


if __name__ == "__main__":
    main()
