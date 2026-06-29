declare module '*.css' {}

// Runtime configuration injected into the page by the root layout
// (see src/app/[locale]/layout.tsx). Read on the client via getApiUrl().
interface Window {
  __ENV__?: {
    API_URL?: string
  }
}
