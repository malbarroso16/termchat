import React, { useEffect, useState } from 'react';
import { Box, render, useStdout } from 'ink';
import { config } from './config';
import { AuthScreen } from './components/AuthScreen';
import { ChatScreen } from './components/ChatScreen';

function App() {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows ?? 24);

  useEffect(() => {
    const onResize = () => setRows(stdout.rows ?? 24);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const [loggedIn, setLoggedIn] = useState(config.isLoggedIn());

  return (
    <Box flexDirection="column" height={rows}>
      {loggedIn ? (
        <ChatScreen onLogout={() => setLoggedIn(false)} />
      ) : (
        <AuthScreen onAuth={() => setLoggedIn(true)} />
      )}
    </Box>
  );
}

render(<App />, { exitOnCtrlC: true });
