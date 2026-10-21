#!/usr/bin/env python3
"""Generic ARC agent using only the Python standard library.

Required environment variables:
  ARC_AGENT_API_URL, MODEL_API_URL, MODEL_API_KEY, MODEL_NAME

Optional:
  ARC_LEVEL=rf01, ARC_VIEW=dual, ARC_HARNESS=state, MAX_STEPS=80
"""

import json
import os
import re
import time
import urllib.error
import urllib.request


ARC_URL = os.environ["ARC_AGENT_API_URL"].rstrip("/")
MODEL_URL = os.environ["MODEL_API_URL"]
MODEL_KEY = os.environ["MODEL_API_KEY"]
MODEL_NAME = os.environ["MODEL_NAME"]
LEVEL = os.getenv("ARC_LEVEL", "rf01")
VIEW = os.getenv("ARC_VIEW", "dual")
HARNESS = os.getenv("ARC_HARNESS", "state")
MAX_STEPS = int(os.getenv("MAX_STEPS", "80"))
ACTIONS = {"W", "A", "S", "D", "E", "WAIT"}


def request_json(url, method="GET", token=None, body=None):
    headers = {"accept": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        headers["content-type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error


def episode_request(episode_id, token, resource, method="GET", body=None):
    return request_json(f"{ARC_URL}/api/v1/episodes/{episode_id}/{resource}", method, token, body)


def wait_for_browser(episode_id, token):
    while True:
        try:
            return episode_request(episode_id, token, "observations/latest")
        except RuntimeError as error:
            if "409" not in str(error):
                raise
            time.sleep(0.5)


def wait_for_command(episode_id, token, command_id):
    deadline = time.time() + 90
    while time.time() < deadline:
        observation = episode_request(episode_id, token, "observations/latest")
        if observation.get("commandId") == command_id:
            return observation
        time.sleep(0.25)
    raise TimeoutError(f"Timed out waiting for command {command_id}")


def model_content(observation, memory):
    screenshot = observation.pop("screenshot", None)
    text = json.dumps({"observation": observation, "memory": memory}, ensure_ascii=False)
    if not screenshot:
        return text
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": screenshot}},
    ]


def parse_model_json(content):
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    match = re.search(r"\{[\s\S]*\}", str(content))
    if not match:
        raise ValueError(f"Model did not return JSON: {content}")
    result = json.loads(match.group(0))
    action = str(result.get("action", "")).upper()
    if action not in ACTIONS:
        raise ValueError(f"Invalid action: {action}")
    return action, result.get("memory")


def choose_action(observation, memory):
    observation_copy = dict(observation)
    payload = {
        "model": MODEL_NAME,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You control a robot in ARC. Choose exactly one action from W,A,S,D,E,WAIT. "
                    "Use observation and memory, avoid repeating failed moves, and stop planning after WIN or GAME_OVER. "
                    "Return strict JSON: {\"action\":\"W\",\"memory\":{\"nextPlan\":\"...\"}}"
                ),
            },
            {"role": "user", "content": model_content(observation_copy, memory)},
        ],
    }
    response = request_json(
        MODEL_URL,
        "POST",
        body=payload,
        token=MODEL_KEY,
    )
    return parse_model_json(response["choices"][0]["message"]["content"])


def main():
    created = request_json(
        f"{ARC_URL}/api/v1/episodes",
        "POST",
        body={"level": LEVEL, "view": VIEW, "harness": HARNESS},
    )
    episode_id = created["episode"]["id"]
    token = created["agentToken"]
    print("\nOpen this game URL in a browser:\n")
    print(created["gameUrl"], "\n", flush=True)
    observation = wait_for_browser(episode_id, token)

    for step in range(MAX_STEPS):
        status = observation.get("status")
        if status in {"WIN", "GAME_OVER"}:
            print(f"Episode finished: {status} after {step} actions")
            return
        memory = episode_request(episode_id, token, "memory")
        action, memory_patch = choose_action(observation, memory)
        if isinstance(memory_patch, dict):
            episode_request(episode_id, token, "memory", "PATCH", memory_patch)
        command = episode_request(
            episode_id,
            token,
            "commands",
            "POST",
            {"kind": "act", "action": action, "durationMs": 300},
        )
        print(f"{step + 1:03d}  {action}")
        observation = wait_for_command(episode_id, token, command["id"])

    print(f"Stopped after MAX_STEPS={MAX_STEPS}")


if __name__ == "__main__":
    main()
