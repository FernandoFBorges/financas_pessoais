import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Nome do repositório no GitHub — usado como base path para o GitHub Pages.
// Se o nome do seu repositório for diferente, troque aqui.
const REPO_NAME = 'financas-app'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Livro Caixa — Controle Financeiro',
        short_name: 'Livro Caixa',
        description: 'Controle financeiro pessoal — despesas, receitas, parcelamentos e recorrências.',
        theme_color: '#16241D',
        background_color: '#16241D',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
}))
