import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const fromConfigDir = (relativePath: string) =>
    decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')

export default defineConfig(({ mode }) => {
    const repoRoot = fromConfigDir('.')
    const env = loadEnv(mode, repoRoot, '')

    const apiGatewayUrl = trimTrailingSlash(env.VITE_API_GATEWAY_URL || 'http://localhost:8080')
    const keycloakUrl = trimTrailingSlash(
        env.VITE_KEYCLOAK_URL || env.KEYCLOAK_SERVER_URL || 'http://13.239.118.235:9090',
    )

    return {
        envDir: '.',
        plugins: [react()],
        resolve: {
            alias: {
                '@': fromConfigDir('./src'),
            },
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: apiGatewayUrl,
                    changeOrigin: true,
                },
                '/_core': {
                    target: 'http://localhost:8081',
                    changeOrigin: true,
                    rewrite: (requestPath) => requestPath.replace(/^\/_core/, ''),
                },
                '/_user': {
                    target: 'http://localhost:8082',
                    changeOrigin: true,
                    rewrite: (requestPath) => requestPath.replace(/^\/_user/, ''),
                },
                '/realms': {
                    target: keycloakUrl,
                    changeOrigin: true,
                },
            },
        },
    }
})
