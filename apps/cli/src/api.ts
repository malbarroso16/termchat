import axios from 'axios';
import { config } from './config';

const SERVER_URL = process.env.TERMCHAT_SERVER ?? 'http://localhost:3000';

const http = axios.create({ baseURL: SERVER_URL });

http.interceptors.request.use((req) => {
  const token = config.getToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export interface Channel {
  id: number;
  name: string;
  description?: string;
  isPrivate: boolean;
}

export interface Message {
  id: number;
  content: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  user: { id: number; username: string };
  channelId: number;
}

export const api = {
  async register(email: string, username: string, password: string) {
    const res = await http.post('/auth/register', { email, username, password });
    return res.data as {
      user: { id: number; username: string };
      accessToken: string;
    };
  },

  async login(email: string, password: string) {
    const res = await http.post('/auth/login', { email, password });
    return res.data as {
      user: { id: number; username: string };
      accessToken: string;
    };
  },

  async getChannels(): Promise<Channel[]> {
    const res = await http.get('/channels');
    return res.data;
  },

  async createChannel(name: string, description?: string): Promise<Channel> {
    const res = await http.post('/channels', { name, description });
    return res.data;
  },
};
