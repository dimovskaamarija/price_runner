import { spawn } from 'child_process';

const port = process.env.PORT || 3000;

console.log(`Starting server on port ${port}...`);

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
