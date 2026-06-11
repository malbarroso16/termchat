import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { api } from '../api';
import { config } from '../config';

type Mode = 'login' | 'register';
type Step = 'mode' | 'email' | 'username' | 'password' | 'loading';

interface Props {
  onAuth: () => void;
}

export function AuthScreen({ onAuth }: Props) {
  const { stdout } = useStdout();
  // Panel fills terminal width minus 4 cols of margin, clamped to [58, 72]
  const panelWidth = Math.max(58, Math.min(72, (stdout.columns ?? 80) - 4));

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('mode');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [inputBuffer, setInputBuffer] = useState('');
  const [error, setError] = useState('');

  useInput(
    (input, key) => {
      if (step === 'loading') return;

      if (step === 'mode') {
        if (key.leftArrow || key.rightArrow) {
          setMode((m) => (m === 'login' ? 'register' : 'login'));
          return;
        }
        if (key.return) {
          setError('');
          setStep('email');
          return;
        }
        return;
      }

      if (key.return) {
        if (step === 'email') {
          if (!inputBuffer.includes('@')) {
            setError('Enter a valid email address.');
            return;
          }
          setEmail(inputBuffer);
          setInputBuffer('');
          setError('');
          setStep(mode === 'register' ? 'username' : 'password');
          return;
        }

        if (step === 'username') {
          if (inputBuffer.trim().length < 3) {
            setError('Username must be at least 3 characters.');
            return;
          }
          setUsername(inputBuffer.trim());
          setInputBuffer('');
          setError('');
          setStep('password');
          return;
        }

        if (step === 'password') {
          const pw = inputBuffer;
          setInputBuffer('');
          setStep('loading');

          const doAuth =
            mode === 'login'
              ? api.login(email, pw)
              : api.register(email, username, pw);

          doAuth
            .then((res) => {
              config.setToken(res.accessToken);
              config.setUsername(res.user.username);
              config.setUserId(res.user.id);
              onAuth();
            })
            .catch((err) => {
              let msg: string;
              if (!err?.response) {
                msg = 'Cannot connect to server. Is it running?';
              } else {
                const raw = err.response.data?.message;
                msg = Array.isArray(raw)
                  ? raw.join(', ')
                  : String(raw ?? err.response.statusText ?? 'Request failed.');
              }
              setError(msg);
              setInputBuffer('');
              setStep('email');
            });
          return;
        }
      }

      if (key.escape) {
        setStep('mode');
        setEmail('');
        setUsername('');
        setInputBuffer('');
        setError('');
        return;
      }

      if (key.backspace || key.delete) {
        setInputBuffer((prev) => prev.slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setInputBuffer((prev) => prev + input);
      }
    },
    { isActive: step !== 'loading' },
  );

  const isRegister = mode === 'register';

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        width={panelWidth}
        paddingX={2}
        paddingY={1}
      >
        {/* Title */}
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">
            TermChat
          </Text>
        </Box>
        <Box justifyContent="center" marginBottom={1}>
          <Text dimColor>Real-time terminal chat</Text>
        </Box>

        {/* Mode selector */}
        <Box justifyContent="center" gap={4} marginBottom={1}>
          <Box
            borderStyle={step === 'mode' && mode === 'login' ? 'single' : undefined}
            borderColor="green"
            paddingX={1}
          >
            <Text
              bold={mode === 'login'}
              color={mode === 'login' ? 'green' : 'gray'}
            >
              {mode === 'login' ? '▶ ' : '  '}Login
            </Text>
          </Box>
          <Box
            borderStyle={step === 'mode' && mode === 'register' ? 'single' : undefined}
            borderColor="green"
            paddingX={1}
          >
            <Text
              bold={mode === 'register'}
              color={mode === 'register' ? 'green' : 'gray'}
            >
              {mode === 'register' ? '▶ ' : '  '}Register
            </Text>
          </Box>
        </Box>

        {/* Error */}
        {error ? (
          <Box marginBottom={1}>
            <Text color="red">✖ {error}</Text>
          </Box>
        ) : null}

        {/* Loading */}
        {step === 'loading' ? (
          <Box justifyContent="center">
            <Text color="yellow">
              {isRegister ? 'Creating account...' : 'Signing in...'}
            </Text>
          </Box>
        ) : step === 'mode' ? (
          <Box justifyContent="center" marginTop={1}>
            <Text dimColor>← → switch  •  Enter to select  •  Ctrl+C to quit</Text>
          </Box>
        ) : (
          <Box flexDirection="column" gap={1}>
            {/* Email */}
            <Box>
              <Text color={step === 'email' ? 'green' : 'gray'} bold>
                {'Email    '}
              </Text>
              <Text color={step === 'email' ? 'green' : undefined}>
                {step === 'email' ? inputBuffer : email}
              </Text>
              {step === 'email' ? <Text color="green">▌</Text> : null}
            </Box>

            {/* Username (register only) */}
            {isRegister ? (
              <Box>
                <Text color={step === 'username' ? 'green' : 'gray'} bold>
                  {'Username '}
                </Text>
                <Text color={step === 'username' ? 'green' : undefined}>
                  {step === 'username' ? inputBuffer : username}
                </Text>
                {step === 'username' ? <Text color="green">▌</Text> : null}
              </Box>
            ) : null}

            {/* Password */}
            <Box>
              <Text color={step === 'password' ? 'green' : 'gray'} bold>
                {'Password '}
              </Text>
              {step === 'password' ? (
                <>
                  <Text color="green">{'*'.repeat(inputBuffer.length)}</Text>
                  <Text color="green">▌</Text>
                </>
              ) : null}
            </Box>

            <Box marginTop={1}>
              <Text dimColor>Enter to continue  •  Esc to go back  •  Ctrl+C to quit</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
