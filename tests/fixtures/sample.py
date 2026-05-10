import os


class UserStore:
    def __init__(self, root: str) -> None:
        self.root = root

    def path_for(self, user_id: str) -> str:
        return os.path.join(self.root, user_id)


def normalize_username(value: str) -> str:
    return value.strip().lower()


def can_login(enabled: bool, attempts: int) -> bool:
    return enabled and attempts < 5
