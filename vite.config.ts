import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages projekt-oldal: az app a /TileSim/ alútvonalon fut
  // (https://gaaaron.github.io/TileSim/). Helyi `npm run dev` a gyökéren fut, ezért csak build-nél kell.
  base: process.env.NODE_ENV === 'production' ? '/TileSim/' : '/',
  plugins: [react()],
});
