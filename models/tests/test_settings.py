import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from models.settings import load_project_env


class SettingsTests(unittest.TestCase):
    def test_local_settings_load_without_overriding_process_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('LLM_PROVIDER=anthropic\nANTHROPIC_MODEL=claude-haiku-5-5\n', encoding='utf-8')
            with patch.dict(os.environ, {'LLM_PROVIDER': 'openai'}, clear=True):
                load_project_env(path)
                self.assertEqual(os.environ['LLM_PROVIDER'], 'openai')
                self.assertEqual(os.environ['ANTHROPIC_MODEL'], 'claude-haiku-5-5')

    def test_missing_local_settings_are_optional(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertFalse(load_project_env(Path(directory) / 'absent.env'))


if __name__ == '__main__':
    unittest.main()
