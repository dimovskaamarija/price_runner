import { spawn } from 'child_process';

const port = process.env.PORT || 3000;

console.log(`Starting server on port ${port}...`);
console.log(`Environment check:`, {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    VITE_API_URL: process.env.VITE_API_URL ? 'SET' : 'NOT SET (build-time only)',
    VITE_AUTH_API_URL: process.env.VITE_AUTH_API_URL ? 'SET' : 'NOT SET (build-time only)',
});

// serve -s = single page app mode (handles client-side routing)
// -l = listen on port
const serve = spawn('npx', ['serve', '-s', 'dist', '-l', port.toString()], {
    stdio: 'inherit',
    shell: true
});

serve.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

serve.on('exit', (code) => {
    process.exit(code);
});
