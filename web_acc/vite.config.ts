import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs/promises';
import svgr from '@svgr/rollup';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    resolve: {
        alias: {
            src: resolve(__dirname, 'src'),
            '@': resolve(__dirname, '.'),

        },
    },
    esbuild: {
        loader: 'tsx',
        include: /src\/.*\.tsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                {
                    name: 'load-js-files-as-tsx',
                    setup(build) {
                        build.onLoad(
                            { filter: /src\\.*\.js$/ },
                            async (args) => ({
                                loader: 'tsx',
                                contents: await fs.readFile(args.path, 'utf8'),
                            })
                        );
                    },
                },
            ],
        },
    },
    build: {
        outDir: 'dist', // ✅ this is required for Netlify
    },
    // The Cloudflare plugin spawns a workerd child process and talks to it over
    // stdio pipes. On Windows that pipe can close mid-write during dev, surfacing
    // as an uncaught `write EOF` that kills the process. This config has no Worker
    // (`main`) — it only serves static SPA assets — so the runtime isn't needed for
    // `vite dev`. Load it only for `vite build`; `preview`/`deploy` go through wrangler.
    plugins: [svgr(), react(), ...(command === 'build' ? [cloudflare()] : [])],
}));