"""Load local, Git-ignored settings without overriding process configuration."""

from pathlib import Path

from dotenv import load_dotenv


def load_project_env(path=None):
    env_path = Path(path) if path is not None else Path(__file__).resolve().parent.parent / '.env'
    return load_dotenv(env_path, override=False)
