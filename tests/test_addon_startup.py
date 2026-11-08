"""Check the storage boundary and privilege drop before launching upstream."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('startup', Path(__file__).resolve().parents[1] / 'ancient-dashboard/run.py')
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


class StartupTests(unittest.TestCase):
    def test_preserves_data_and_drops_privileges_before_exec(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / 'dashboard'
            data.mkdir()
            database = data / 'dashboard.sqlite3'
            database.write_bytes(b'existing dashboard')
            with patch.object(startup, 'DATA_DIR', data), patch.object(startup.os, 'environ', {}), patch.object(startup.os, 'chown') as owner, patch.object(startup.os, 'setgroups') as groups, patch.object(startup.os, 'setgid') as gid, patch.object(startup.os, 'setuid') as uid, patch.object(startup.os, 'chdir'), patch.object(startup.os, 'execv') as execute:
                order = unittest.mock.Mock()
                for name, mock in [('groups', groups), ('gid', gid), ('uid', uid), ('exec', execute)]:
                    order.attach_mock(mock, name)
                startup.main()
                owner.assert_called_once_with(data, 10001, 10001)
                self.assertEqual([c[0] for c in order.mock_calls], ['groups', 'gid', 'uid', 'exec'])
                self.assertEqual(startup.os.environ['ANCIENT_DATA_DIR'], str(data))
                self.assertEqual(execute.call_args.args[1][-2:], ['--data-dir', str(data)])
            self.assertEqual(database.read_bytes(), b'existing dashboard')
            self.assertEqual(data.stat().st_mode & 0o777, 0o700)

    def test_rejects_symlink_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / 'dashboard'
            data.symlink_to(directory, target_is_directory=True)
            with patch.object(startup, 'DATA_DIR', data), patch.object(startup.os, 'chown') as owner:
                with self.assertRaises(RuntimeError):
                    startup.main()
                owner.assert_not_called()


if __name__ == '__main__':
    unittest.main()
