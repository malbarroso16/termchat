import Conf from 'conf';
import path from 'path';

const configDir = process.env.CHAT_CONFIG_PATH
  ? path.resolve(process.env.CHAT_CONFIG_PATH)
  : undefined;

const store = new Conf<{ token: string; username: string; userId: number }>({
  projectName: 'termchat',
  cwd: configDir,
});

export const config = {
  getToken: () => store.get('token'),
  setToken: (token: string) => store.set('token', token),
  getUsername: () => store.get('username'),
  setUsername: (username: string) => store.set('username', username),
  getUserId: () => store.get('userId'),
  setUserId: (id: number) => store.set('userId', id),
  clear: () => store.clear(),
  isLoggedIn: () => !!store.get('token'),
};
