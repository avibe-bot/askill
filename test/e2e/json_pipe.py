"""Run against a built CLI: python3 test/e2e/json_pipe.py [node] /path/to/cli"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class JsonPipeTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.home = Path(tmp.name)
        self.project = self.home / "project"
        self.project.mkdir()

    def run_json(self, args, status):
        # subprocess.PIPE is the same OS pipe used by HTTP API consumers, not a
        # regular file or a terminal. Keep all discovery inside the fixture.
        result = subprocess.run(
            [*CLI, *args, "--json"], cwd=self.project,
            env={"PATH": os.defpath, "HOME": str(self.home), "USERPROFILE": str(self.home)},
            stdin=subprocess.DEVNULL, capture_output=True, timeout=20,
        )
        self.assertEqual(result.returncode, status, result.stderr)
        try:
            payload = json.loads(result.stdout)
        except ValueError as error:
            self.fail(f"invalid JSON after {len(result.stdout)} bytes: {error}")
        self.assertGreater(len(result.stdout), 64 * 1024)
        return payload

    def test_complete_global_skill_list(self):
        names = [f"skill-{i:03}" for i in range(90)]
        description = "测试 description " * 100 + "end"
        for name in names:
            skill = self.home / ".agents" / "skills" / name
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                f"---\nname: {name}\ndescription: {description}\n---\n", encoding="utf-8"
            )
        payload = self.run_json(["list", "-g"], 0)
        self.assertIs(payload["ok"], True)
        self.assertEqual(payload["count"], len(names))
        self.assertCountEqual([s["name"] for s in payload["skills"]], names)
        self.assertTrue(all(s["description"] == description for s in payload["skills"]))

    def test_complete_error_before_nonzero_exit(self):
        # Large in UTF-8 but below the single-argument limit.
        invalid = "错" * 24_000
        payload = self.run_json(["list", "-a", invalid], 1)
        self.assertIs(payload["ok"], False)
        self.assertEqual(payload["error"]["code"], "INVALID_AGENTS")
        self.assertEqual(payload["error"]["details"]["invalidAgents"], [invalid])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    CLI = [shutil.which(sys.argv[1]) or sys.argv[1], *sys.argv[2:]]
    CLI = [str(Path(arg).resolve()) for arg in CLI]
    unittest.main(argv=[sys.argv[0]])
